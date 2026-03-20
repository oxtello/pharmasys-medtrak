import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryTransactionHash,
  getPreviousInventoryTransactionHash,
} from "@/lib/ledger-hash";

type AdjustRequestBody = {
  barcode?: string;
  locationId?: string;
  adjustmentType?: "ADD" | "SUBTRACT";
  quantity?: number | string;
  reasonCode?: string;
  note?: string;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function isControlledSubstance(deaSchedule?: string | null) {
  const normalized = normalizeText(deaSchedule).toUpperCase();
  return ["C2", "C3", "C4", "C5"].includes(normalized);
}

export async function POST(req: Request) {
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

    if (actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can adjust inventory" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as AdjustRequestBody;

    const barcode = normalizeText(body.barcode);
    const locationId = normalizeText(body.locationId);
    const adjustmentType = body.adjustmentType;
    const reasonCode = normalizeText(body.reasonCode);
    const note = normalizeText(body.note);
    const numericQuantity = Number(body.quantity);

    if (
      !barcode ||
      !locationId ||
      !adjustmentType ||
      body.quantity === undefined ||
      body.quantity === null ||
      !reasonCode
    ) {
      return NextResponse.json(
        {
          error:
            "barcode, locationId, adjustmentType, quantity, and reasonCode are required",
        },
        { status: 400 }
      );
    }

    if (!["ADD", "SUBTRACT"].includes(adjustmentType)) {
      return NextResponse.json(
        { error: "adjustmentType must be ADD or SUBTRACT" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be greater than 0" },
        { status: 400 }
      );
    }

    const actorLocationId = actor.homeLocationId ?? null;

    if (actorLocationId && actorLocationId !== locationId) {
      return NextResponse.json(
        { error: "You can only write transactions for your active location" },
        { status: 403 }
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

    const noteText = [
      `Adjustment: ${adjustmentType}`,
      `Reason: ${reasonCode}`,
      note ? `Note: ${note}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const result = await prisma.$transaction(async (tx) => {
      let totalOnHandBefore = 0;

      if (adjustmentType === "ADD") {
        const items = await tx.inventoryItem.findMany({
          where: {
            medicationId: medication.id,
            locationId,
            status: "ACTIVE",
          },
          orderBy: [{ createdAt: "asc" }],
        });

        totalOnHandBefore = items.reduce(
          (sum, item) => sum + Number(item.quantityOnHand ?? 0),
          0
        );

        const existing = items[0];

        if (existing) {
          const currentQty = Number(existing.quantityOnHand ?? 0);

          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantityOnHand: (currentQty + numericQuantity).toString(),
              status: "ACTIVE",
            },
          });
        } else {
          await tx.inventoryItem.create({
            data: {
              medicationId: medication.id,
              locationId,
              quantityOnHand: numericQuantity.toString(),
              status: "ACTIVE",
            },
          });
        }
      } else {
        const items = await tx.inventoryItem.findMany({
          where: {
            medicationId: medication.id,
            locationId,
            status: "ACTIVE",
          },
          orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
        });

        totalOnHandBefore = items.reduce(
          (sum, item) => sum + Number(item.quantityOnHand ?? 0),
          0
        );

        if (totalOnHandBefore < numericQuantity) {
          throw new Error(`INSUFFICIENT_INVENTORY:${totalOnHandBefore}`);
        }

        let remaining = numericQuantity;

        for (const item of items) {
          if (remaining <= 0) break;

          const itemQty = Number(item.quantityOnHand ?? 0);
          if (itemQty <= 0) continue;

          const deduction = Math.min(itemQty, remaining);
          const newQty = itemQty - deduction;

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
              quantityOnHand: newQty.toString(),
              status: newQty <= 0 ? "DEPLETED" : item.status,
            },
          });

          remaining -= deduction;
        }
      }

      const signedQuantity =
        adjustmentType === "ADD" ? numericQuantity : -numericQuantity;

      const totalOnHandAfter =
        adjustmentType === "ADD"
          ? totalOnHandBefore + numericQuantity
          : totalOnHandBefore - numericQuantity;

      const previousHash = await getPreviousInventoryTransactionHash(tx);

      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          type: "ADJUST",
          locationId,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: signedQuantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode,
          note: noteText,
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
        adjustmentType,
        quantity: numericQuantity,
        signedQuantity,
        inventoryUnit: String(medication.inventoryUnit),
        reasonCode,
        note: note || null,
        controlled,
        deaSchedule: medication.deaSchedule || null,
        onHandBefore: totalOnHandBefore,
        onHandAfter: totalOnHandAfter,
      };

      await tx.auditEvent.create({
        data: {
          occurredAt: transaction.occurredAt,
          category: controlled ? "CONTROLLED_SUBSTANCE" : "INVENTORY",
          action: "ADJUST",
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
            `${adjustmentType} ${numericQuantity} ${medication.inventoryUnit}`,
            `Reason: ${reasonCode}`,
            `On hand before: ${totalOnHandBefore}`,
            `On hand after: ${totalOnHandAfter}`,
            controlled ? `DEA: ${medication.deaSchedule}` : null,
            note ? `Note: ${note}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          metadataJson: JSON.stringify(metadata),
        },
      });

      return {
        transaction,
        totalOnHandBefore,
        totalOnHandAfter,
        controlled,
      };
    });

    return NextResponse.json({
      success: true,
      transactionId: result.transaction.id,
      transactionHash: result.transaction.hash,
      onHandBefore: result.totalOnHandBefore,
      onHandAfter: result.totalOnHandAfter,
      controlled: result.controlled,
    });
  } catch (error) {
    console.error("ADJUST_ROUTE_ERROR", error);

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_INVENTORY:")) {
      const onHand = error.message.split(":")[1] ?? "0";

      return NextResponse.json(
        { error: `Insufficient inventory. On hand: ${onHand}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Adjust transaction failed",
      },
      { status: 500 }
    );
  }
}
