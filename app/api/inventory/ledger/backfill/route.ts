import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { buildInventoryTransactionHash } from "@/lib/ledger-hash";

export async function POST() {
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
        { error: "Only admins can backfill the inventory ledger" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const transactions = await tx.inventoryTransaction.findMany({
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
        },
      });

      let previousHash: string | null = null;
      let updatedCount = 0;

      for (const txRow of transactions) {
        const expectedHash = buildInventoryTransactionHash({
          id: txRow.id,
          type: txRow.type,
          locationId: txRow.locationId,
          medicationId: txRow.medicationId,
          actorUserId: txRow.actorUserId,
          witnessUserId: txRow.witnessUserId,
          quantity: txRow.quantity,
          inventoryUnit: txRow.inventoryUnit,
          lotNumber: txRow.lotNumber,
          expirationDate: txRow.expirationDate,
          barcode: txRow.barcode,
          note: txRow.note,
          referenceId: txRow.referenceId,
          occurredAt: txRow.occurredAt,
          previousHash,
          chainVersion: 1,
        });

        const needsUpdate =
          (txRow.previousHash ?? null) !== previousHash ||
          (txRow.hash ?? null) !== expectedHash ||
          txRow.chainVersion !== 1;

        if (needsUpdate) {
          await tx.inventoryTransaction.update({
            where: { id: txRow.id },
            data: {
              previousHash,
              hash: expectedHash,
              chainVersion: 1,
            },
          });

          updatedCount += 1;
        }

        previousHash = expectedHash;
      }

      return {
        transactionCount: transactions.length,
        updatedCount,
        chainHeadHash: previousHash,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      backfilledAt: new Date().toISOString(),
      backfilledBy: {
        id: actor.id,
        email: session.user.email,
        role: actor.role,
      },
    });
  } catch (error) {
    console.error("Ledger backfill failed:", error);
    return NextResponse.json(
      { error: "Ledger backfill failed" },
      { status: 500 }
    );
  }
}
