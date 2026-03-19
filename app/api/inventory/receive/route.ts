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

function cleanOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "INVALID_DATE" : parsed;
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

    const barcode = cleanString(body.barcode);
    const locationId = cleanString(body.locationId);
    const lotNumber = cleanOptionalString(body.lotNumber);
    const note = cleanOptionalString(body.note);
    const expirationDate = cleanOptionalDate(body.expirationDate);
    const numericQuantity = Number(body.quantity);

    if (!barcode || !locationId || body.quantity === undefined || body.quantity === null) {
      return NextResponse.json(
        { error: "barcode, locationId, and quantity are required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be greater than 0" },
        { status: 400 }
      );
    }

    if (expirationDate === "INVALID_DATE") {
      return NextResponse.json(
        { error: "expirationDate must be a valid date" },
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
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
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
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          locationId: location.id,
          medicationId: medication.id,
          lotNumber,
          expirationDate: expirationDate instanceof Date ? expirationDate : null,
          quantityOnHand: numericQuantity.toString(),
          status: "ACTIVE",
        },
      });

      const previousHash = await getPreviousInventoryTransactionHash(tx);

      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          type: "RECEIVE",
          locationId: location.id,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: numericQuantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          lotNumber,
          expirationDate: expirationDate instanceof Date ? expirationDate : null,
          barcode: medication.barcode,
          note,
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

      return {
        inventoryItem,
        transaction,
      };
    });

    await logAuditEvent({
      occurredAt: result.transaction.occurredAt,
      category: "Inventory",
      action: "RECEIVE",
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
        transactionType: "RECEIVE",
        quantity: numericQuantity,
        inventoryUnit: medication.inventoryUnit,
        deaSchedule: medication.deaSchedule,
        barcode: medication.barcode,
        note,
      }),
      metadata: {
        barcode: medication.barcode,
        lotNumber,
        expirationDate:
          expirationDate instanceof Date ? expirationDate.toISOString() : null,
        quantity: numericQuantity,
        inventoryUnit: medication.inventoryUnit,
        transactionHash: result.transaction.hash,
        inventoryItemId: result.inventoryItem.id,
      },
    });

    return NextResponse.json({
      success: true,
      inventoryItemId: result.inventoryItem.id,
      transactionId: result.transaction.id,
      transactionHash: result.transaction.hash,
    });
  } catch (error) {
    console.error("POST /api/inventory/receive error:", error);

    return NextResponse.json(
      { error: "Receive transaction failed" },
      { status: 500 }
    );
  }
}
