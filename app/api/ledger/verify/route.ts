import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInventoryTransactionHash } from "@/lib/ledger-hash";

type LedgerIssue = {
  transactionId: string;
  occurredAt: string;
  type: string;
  locationId: string;
  medicationId: string;
  issue:
    | "MISSING_HASH"
    | "HASH_MISMATCH"
    | "BROKEN_PREVIOUS_HASH"
    | "UNEXPECTED_PREVIOUS_HASH";
  expectedPreviousHash: string | null;
  actualPreviousHash: string | null;
  expectedHash?: string | null;
  actualHash?: string | null;
};

function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = normalizePositiveInt(searchParams.get("limit"), 5000);
    const includeValidRows = searchParams.get("includeValidRows") === "true";

    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: [
        { occurredAt: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: limit,
    });

    let previousHash: string | null = null;
    let verifiedCount = 0;

    const issues: LedgerIssue[] = [];
    const validRows: Array<{
      transactionId: string;
      occurredAt: string;
      type: string;
      hash: string | null;
      previousHash: string | null;
    }> = [];

    for (const tx of transactions) {
      const expectedHash = buildInventoryTransactionHash({
        id: tx.id,
        type: tx.type,
        locationId: tx.locationId,
        medicationId: tx.medicationId,
        actorUserId: tx.actorUserId,
        witnessUserId: tx.witnessUserId,
        quantity: tx.quantity,
        inventoryUnit: tx.inventoryUnit,
        lotNumber: tx.lotNumber,
        expirationDate: tx.expirationDate,
        barcode: tx.barcode,
        note: tx.note,
        referenceId: tx.referenceId,
        occurredAt: tx.occurredAt,
        previousHash: tx.previousHash,
        chainVersion: tx.chainVersion,
      });

      let hasIssue = false;

      if (!tx.hash) {
        issues.push({
          transactionId: tx.id,
          occurredAt: tx.occurredAt.toISOString(),
          type: String(tx.type),
          locationId: tx.locationId,
          medicationId: tx.medicationId,
          issue: "MISSING_HASH",
          expectedPreviousHash: previousHash,
          actualPreviousHash: tx.previousHash,
          expectedHash,
          actualHash: tx.hash,
        });
        hasIssue = true;
      }

      if (tx.previousHash !== previousHash) {
        issues.push({
          transactionId: tx.id,
          occurredAt: tx.occurredAt.toISOString(),
          type: String(tx.type),
          locationId: tx.locationId,
          medicationId: tx.medicationId,
          issue: previousHash === null
            ? "UNEXPECTED_PREVIOUS_HASH"
            : "BROKEN_PREVIOUS_HASH",
          expectedPreviousHash: previousHash,
          actualPreviousHash: tx.previousHash,
          expectedHash,
          actualHash: tx.hash,
        });
        hasIssue = true;
      }

      if (tx.hash && tx.hash !== expectedHash) {
        issues.push({
          transactionId: tx.id,
          occurredAt: tx.occurredAt.toISOString(),
          type: String(tx.type),
          locationId: tx.locationId,
          medicationId: tx.medicationId,
          issue: "HASH_MISMATCH",
          expectedPreviousHash: previousHash,
          actualPreviousHash: tx.previousHash,
          expectedHash,
          actualHash: tx.hash,
        });
        hasIssue = true;
      }

      if (!hasIssue) {
        verifiedCount += 1;

        if (includeValidRows) {
          validRows.push({
            transactionId: tx.id,
            occurredAt: tx.occurredAt.toISOString(),
            type: String(tx.type),
            hash: tx.hash,
            previousHash: tx.previousHash,
          });
        }
      }

      previousHash = tx.hash ?? null;
    }

    const distinctIssueTransactions = new Set(issues.map((issue) => issue.transactionId)).size;
    const chainValid = issues.length === 0;

    return NextResponse.json({
      success: true,
      chainValid,
      checkedTransactions: transactions.length,
      verifiedTransactions: verifiedCount,
      issueCount: issues.length,
      affectedTransactionCount: distinctIssueTransactions,
      latestVerifiedHash:
        transactions.length > 0 && chainValid
          ? transactions[transactions.length - 1]?.hash ?? null
          : null,
      issues,
      validRows: includeValidRows ? validRows : undefined,
      note:
        transactions.length === limit
          ? "Verification was limited by the requested row cap. Increase ?limit= if needed."
          : undefined,
    });
  } catch (error) {
    console.error("LEDGER_VERIFY_ROUTE_ERROR", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ledger verification failed",
      },
      { status: 500 }
    );
  }
}
