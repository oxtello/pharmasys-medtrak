import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInventoryTransactionHash } from "@/lib/ledger-hash";

type IntegrityResult = {
  verified: boolean;
  checkedRecords: number;
  brokenAtTransactionId?: string | null;
  firstBrokenIndex?: number | null;
  expectedPreviousHash?: string | null;
  actualPreviousHash?: string | null;
  expectedHash?: string | null;
  actualHash?: string | null;
};

export async function GET() {
  try {
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

    const result: IntegrityResult = {
      verified: true,
      checkedRecords: transactions.length,
      brokenAtTransactionId: null,
      firstBrokenIndex: null,
      expectedPreviousHash: null,
      actualPreviousHash: null,
      expectedHash: null,
      actualHash: null,
    };

    let priorHash: string | null = null;

    for (let index = 0; index < transactions.length; index++) {
      const tx = transactions[index];

      const expectedPreviousHash = index === 0 ? null : priorHash;
      const actualPreviousHash = tx.previousHash ?? null;

      if (actualPreviousHash !== expectedPreviousHash) {
        result.verified = false;
        result.brokenAtTransactionId = tx.id;
        result.firstBrokenIndex = index;
        result.expectedPreviousHash = expectedPreviousHash;
        result.actualPreviousHash = actualPreviousHash;
        result.expectedHash = null;
        result.actualHash = tx.hash ?? null;
        break;
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

      const actualHash = tx.hash ?? null;

      if (actualHash !== expectedHash) {
        result.verified = false;
        result.brokenAtTransactionId = tx.id;
        result.firstBrokenIndex = index;
        result.expectedPreviousHash = expectedPreviousHash;
        result.actualPreviousHash = actualPreviousHash;
        result.expectedHash = expectedHash;
        result.actualHash = actualHash;
        break;
      }

      priorHash = actualHash;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("LEDGER_INTEGRITY_ROUTE_ERROR", error);

    return NextResponse.json(
      { error: "Ledger integrity verification failed" },
      { status: 500 }
    );
  }
}
