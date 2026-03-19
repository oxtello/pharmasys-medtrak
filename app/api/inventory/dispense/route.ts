import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryTransactionHash,
  getPreviousInventoryTransactionHash,
} from "@/lib/ledger-hash";
import { logAuditEvent, buildInventoryAuditDetails } from "@/lib/audit-events";

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanOptionalString(value: unknown) {
  const trimmed = cleanString(value);
  return trimmed.length ? trimmed : null;
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const body = await req.json();

    const barcode = cleanString(body?.barcode);
    const locationId = cleanString(body?.locationId);
    const patient = cleanString(body?.patient);
    const encounterId = cleanString(body?.encounterId);
    const freeTextNote = cleanOptionalString(body?.note);
    const quantity = toNumber(body?.quantity);

    if (!barcode || !locationId || body?.quantity === undefined || body?.quantity === null) {
      return NextResponse.json(
        { error: "barcode, locationId, and quantity are required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be greater than 0" },
        { status: 400 }
      );
    }

    if (!patient || !encounterId) {
      return NextResponse.json(
        { error: "patient and encounterId are required" },
        { status: 400 }
      );
    }

    const medication = await prisma.medicationMaster.findUnique({
      where: { barcode },
      select: {
        id: true,
        name: true,
        barcode: true,
        inventoryUnit: true,
        deaSchedule: true,
        isActive: true,
      },
    });

    if (!medication || !medication.isActive) {
      return NextResponse.json(
        { error: "Medication not found" },
        { status: 404 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!location || !location.isActive) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        medicationId: medication.id,
        locationId: location.id,
        status: "ACTIVE",
      },
      orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        quantityOnHand: true,
      },
    });

    const totalOnHand = inventoryItems.reduce(
      (sum, item) => sum + Number(item.quantityOnHand),
      0
    );

    if (totalOnHand < quantity) {
      return NextResponse.json(
        { error: "Insufficient inventory for dispense" },
        { status: 400 }
      );
    }

    const combinedNoteParts = [
      `Patient: ${patient}`,
      `Encounter ID: ${encounterId}`,
      freeTextNote ? `Note: ${freeTextNote}` : "",
    ].filter(Boolean);

    const combinedNote = combinedNoteParts.join(" | ");

    const result = await prisma.$transaction(async (tx) => {
      let remainingToDispense = quantity;

      const touchedItems: Array<{
        id: string;
        quantityOnHand: number;
      }> = [];

      for (const item of inventoryItems) {
        if (remainingToDispense <= 0) break;

        const itemOnHand = Number(item.quantityOnHand);
        if (!Number.isFinite(itemOnHand) || itemOnHand <= 0) continue;

        const amountFromThisItem = Math.min(itemOnHand, remainingToDispense);
        const newQuantity = itemOnHand - amountFromThisItem;

        const updated = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantityOnHand: newQuantity.toString(),
          },
          select: {
            id: true,
            quantityOnHand: true,
          },
        });

        touchedItems.push({
          id: updated.id,
          quantityOnHand: Number(updated.quantityOnHand),
        });

        remainingToDispense -= amountFromThisItem;
      }

      if (remainingToDispense > 0) {
        throw new Error("Insufficient inventory for dispense");
      }

      const previousHash = await getPreviousInventoryTransactionHash(tx);

      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          type: "DISPENSE",
          locationId: location.id,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: quantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode: medication.barcode,
          note: combinedNote || null,
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
        select: {
          id: true,
          hash: true,
          occurredAt: true,
        },
      });

      return {
        touchedItems,
        transaction,
      };
    });

    await logAuditEvent({
      occurredAt: result.transaction.occurredAt,
      category: "Inventory",
      action: "DISPENSE",
      actorUserId: actor.id,
      actorName: actor.name,
      locationId: location.id,
      locationName: location.name,
      medicationId: medication.id,
      medicationName: medication.name,
      inventoryTransactionId: result.transaction.id,
      entityType: "InventoryTransaction",
      entityId: result.transaction.id,
      details: buildInventoryAuditDetails({
        transactionType: "DISPENSE",
        quantity,
        inventoryUnit: medication.inventoryUnit,
        deaSchedule: medication.deaSchedule,
        barcode: medication.barcode,
        note: combinedNote || null,
      }),
      metadata: {
        barcode: medication.barcode,
        patient,
        encounterId,
        note: freeTextNote,
        quantity,
        inventoryUnit: medication.inventoryUnit,
        transactionHash: result.transaction.hash,
        inventoryItemsUpdated: result.touchedItems.length,
      },
    });

    return NextResponse.json({
      success: true,
      medication: {
        id: medication.id,
        name: medication.name,
        barcode: medication.barcode,
      },
      location: {
        id: location.id,
        name: location.name,
      },
      quantityDispensed: quantity,
      inventoryItemsUpdated: result.touchedItems.length,
      transactionId: result.transaction.id,
      transactionHash: result.transaction.hash,
    });
  } catch (error) {
    console.error("POST /api/inventory/dispense error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to dispense medication",
      },
      { status: 500 }
    );
  }
}
