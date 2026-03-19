import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryTransactionHash,
  getPreviousInventoryTransactionHash,
} from "@/lib/ledger-hash";

type CycleCountRequestBody = {
  barcode?: string;
  locationId?: string;
  actualCount?: number | string;
  comment?: string;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function isControlledSubstance(deaSchedule?: string | null) {
  const normalized = normalizeText(deaSchedule).toUpperCase();
  return ["C2", "C3", "C4", "C5"].includes(normalized);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = (await req.json()) as CycleCountRequestBody;

    const barcode = normalizeText(body.barcode);
    const locationId = normalizeText(body.locationId);
    const comment = normalizeText(body.comment);
    const numericActualCount = Number(body.actualCount);

    if (!barcode || !locationId || body.actualCount === undefined || body.actualCount === null) {
      return NextResponse.json(
        { error: "barcode, locationId, and actualCount are required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(numericActualCount) || numericActualCount < 0) {
      return NextResponse.json(
        { error: "actualCount must be 0 or greater" },
        { status: 400 }
      );
    }

    const medication = await prisma.medicationMaster.findUnique({
      where: { barcode },
    });

    if (!medication || !medication.isActive) {
      return NextResponse.json(
        { error: "Medication not found" },
        { status: 404 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.isActive) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const controlled = isControlledSubstance(medication.deaSchedule);

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({
        where: {
          medicationId: medication.id,
          locationId,
          status: "ACTIVE",
        },
        orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
      });

      const expectedCount = items.reduce(
        (sum, item) => sum + Number(item.quantityOnHand ?? 0),
        0
      );

      const variance = numericActualCount - expectedCount;

      if (variance !== 0 && !comment) {
        throw new Error("VARIANCE_COMMENT_REQUIRED");
      }

      if (variance > 0) {
        const existing = await tx.inventoryItem.findFirst({
          where: {
            medicationId: medication.id,
            locationId,
            status: "ACTIVE",
          },
          orderBy: [{ createdAt: "asc" }],
        });

        if (existing) {
          const currentQty = Number(existing.quantityOnHand ?? 0);

          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantityOnHand: (currentQty + variance).toString(),
              status: "ACTIVE",
            },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              medicationId: medication.id,
              locationId,
              quantityOnHand: variance.toString(),
              status: "ACTIVE",
            },
          });
        }
      } else if (variance < 0) {
        let remainingToRemove = Math.abs(variance);

        for (const item of items) {
          if (remainingToRemove <= 0) break;

          const itemQty = Number(item.quantityOnHand ?? 0);
          if (itemQty <= 0) continue;

          const deduction = Math.min(itemQty, remainingToRemove);
          const newQty = itemQty - deduction;

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
              quantityOnHand: newQty.toString(),
              status: newQty <= 0 ? "DEPLETED" : item.status,
            },
          });

          remainingToRemove -= deduction;
        }
      }

      const previousHash = await getPreviousInventoryTransactionHash(tx);

      const noteText = [
        `Expected: ${expectedCount}`,
        `Actual: ${numericActualCount}`,
        `Variance: ${variance}`,
        comment ? `Comment: ${comment}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          type: "CYCLE_COUNT",
          locationId,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: variance.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode,
          note: noteText,
          referenceId: `cycle-count:${barcode}:${locationId}`,
          previousHash,
          chainVersion: 1,
        },
      });

      const hash = buildInventoryTransactionHash({
        id: createdTransaction.id,
        type: createdTransaction.type,
        locationId: createdTransaction.locationId,
        medicationId: createdTransaction.medicationId,
        actorUserId: createdTransaction.actorUserId,
        witnessUserId: createdTransaction.witnessUserId,
        quantity: createdTransaction.quantity,
        inventoryUnit: createdTransaction.inventoryUnit,
        lotNumber: createdTransaction.lotNumber,
        expirationDate: createdTransaction.expirationDate,
        barcode: createdTransaction.barcode,
        note: createdTransaction.note,
        referenceId: createdTransaction.referenceId,
        occurredAt: createdTransaction.occurredAt,
        previousHash: createdTransaction.previousHash,
        chainVersion: createdTransaction.chainVersion,
      });

      const transaction = await tx.inventoryTransaction.update({
        where: { id: createdTransaction.id },
        data: { hash },
      });

      const metadata = {
        transactionId: transaction.id,
        transactionHash: transaction.hash,
        previousHash: transaction.previousHash,
        chainVersion: transaction.chainVersion,
        transactionType: transaction.type,
        barcode,
        expectedCount,
        actualCount: numericActualCount,
        variance,
        inventoryUnit: String(medication.inventoryUnit),
        comment: comment || null,
        controlled,
        deaSchedule: medication.deaSchedule || null,
        referenceId: transaction.referenceId || null,
      };

      await tx.auditEvent.create({
        data: {
          occurredAt: transaction.occurredAt,
          category: controlled ? "CONTROLLED_SUBSTANCE" : "INVENTORY",
          action: "CYCLE_COUNT",
          actorUserId: actor.id,
          actorName: actor.name,
          locationId: location.id,
          locationName: location.name,
          medicationId: medication.id,
          medicationName: medication.name,
          inventoryTransactionId: transaction.id,
          entityType: "InventoryTransaction",
          entityId: transaction.id,
          details: [
            `Expected: ${expectedCount} ${medication.inventoryUnit}`,
            `Actual: ${numericActualCount} ${medication.inventoryUnit}`,
            `Variance: ${variance} ${medication.inventoryUnit}`,
            controlled ? `DEA: ${medication.deaSchedule}` : null,
            comment ? `Comment: ${comment}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          metadataJson: JSON.stringify(metadata),
        },
      });

      await tx.cycleCountTask.updateMany({
        where: {
          medicationId: medication.id,
          locationId,
          status: "OPEN",
        },
        data: {
          status: "COMPLETED",
          completedAt: transaction.occurredAt,
          completedByUserId: actor.id,
        },
      });

      return {
        transaction,
        expectedCount,
        actualCount: numericActualCount,
        variance,
        controlled,
      };
    });

    return NextResponse.json({
      success: true,
      transactionId: result.transaction.id,
      transactionHash: result.transaction.hash,
      expectedCount: result.expectedCount,
      actualCount: result.actualCount,
      variance: result.variance,
      controlled: result.controlled,
    });
  } catch (error) {
    console.error("CYCLE_COUNT_ROUTE_ERROR", error);

    if (error instanceof Error && error.message === "VARIANCE_COMMENT_REQUIRED") {
      return NextResponse.json(
        { error: "Comment is required when there is a variance" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cycle count failed",
      },
      { status: 500 }
    );
  }
}
