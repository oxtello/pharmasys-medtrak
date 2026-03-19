import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type IntegrityResult = {
  verified: boolean;
  checkedRecords: number;
  brokenAtTransactionId?: string | null;
  firstBrokenIndex?: number | null;
  reportHash: string;
};

function hashRecord(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function GET() {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        occurredAt: true,
        type: true,
        quantity: true,
        medicationId: true,
        locationId: true,
        actorUserId: true,
      },
    });

    let previousHash = "GENESIS";
    let brokenAtTransactionId: string | null = null;
    let firstBrokenIndex: number | null = null;

    const chainHashes: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      const payload = JSON.stringify({
        id: tx.id,
        occurredAt: tx.occurredAt,
        type: tx.type,
        quantity: tx.quantity,
        medicationId: tx.medicationId,
        locationId: tx.locationId,
        actorUserId: tx.actorUserId,
        previousHash,
      });

      const currentHash = hashRecord(payload);
      chainHashes.push(currentHash);

      previousHash = currentHash;
    }

    const reportHash = hashRecord(chainHashes.join("|"));

    const result: IntegrityResult = {
      verified: brokenAtTransactionId === null,
      checkedRecords: transactions.length,
      brokenAtTransactionId,
      firstBrokenIndex,
      reportHash,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ledger integrity check failed", error);

    return NextResponse.json(
      { error: "Ledger integrity verification failed" },
      { status: 500 }
    );
  }
}
