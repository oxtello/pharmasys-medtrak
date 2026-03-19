import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { buildInventoryTransactionHash } from "@/lib/ledger-hash";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can verify the inventory ledger" },
        { status: 403 }
      );
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        type: true,
        locationId: true,
        medicationId: true,
        actorUserId: true,
        witnessUserId: true,
        quantity: true,
        inventoryUnit: true,
        lotNumber: true,
        expirationDate: true,
        barcode: true,
        note: true,
        referenceId: true,
        previousHash: true,
        hash: true,
        chainVersion: true,
        occurredAt: true,
        createdAt: true,
      },
    });

    const issues: Array<{
      transactionId: string;
      issue: string;
      expected?: string | null;
      actual?: string | null;
    }> = [];

    let expectedPreviousHash: string | null = null;

    for (const tx of transactions) {
      if ((tx.previousHash ?? null) !== expectedPreviousHash) {
        issues.push({
          transactionId: tx.id,
          issue: "previous_hash_mismatch",
          expected: expectedPreviousHash,
          actual: tx.previousHash ?? null,
        });
      }

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

      if ((tx.hash ?? null) !== expectedHash) {
        issues.push({
          transactionId: tx.id,
          issue: "hash_mismatch",
          expected: expectedHash,
          actual: tx.hash ?? null,
        });
      }

      expectedPreviousHash = tx.hash ?? null;
    }

    const lastTransaction =
      transactions.length > 0 ? transactions[transactions.length - 1] : null;

    return NextResponse.json({
      success: true,
      verified: issues.length === 0,
      transactionCount: transactions.length,
      issueCount: issues.length,
      chainHeadHash: lastTransaction?.hash ?? null,
      lastTransactionId: lastTransaction?.id ?? null,
      lastOccurredAt: lastTransaction?.occurredAt ?? null,
      verifiedAt: new Date().toISOString(),
      verifiedBy: {
        id: actor.id,
        email: session.user.email,
        role: actor.role,
      },
      issues,
    });

  } catch (error) {
    console.error("Ledger verify failed:", error);

    return NextResponse.json(
      { error: "Ledger verification failed" },
      { status: 500 }
    );
  }
}
