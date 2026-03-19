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
    const fromLocationId = cleanString(body?.fromLocationId);
    const toLocationId = cleanString(body?.toLocationId);
    const note = cleanOptionalString(body?.note);
    const numericQuantity = toNumber(body?.quantity);

    if (
      !barcode ||
      !fromLocationId ||
      !toLocationId ||
      body?.quantity === undefined ||
      body?.quantity === null
    ) {
      return NextResponse.json(
        { error: "barcode, fromLocationId, toLocationId, and quantity are required" },
        { status: 400 }
      );
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: "Source and destination locations must be different" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be greater than 0" },
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

    const [fromLocation, toLocation] = await Promise.all([
      prisma.location.findUnique({
        where: { id: fromLocationId },
        select: { id: true, name: true, isActive: true },
      }),
      prisma.location.findUnique({
        where: { id: toLocationId },
        select: { id: true, name: true, isActive: true },
      }),
    ]);

    if (!fromLocation || !fromLocation.isActive) {
      return NextResponse.json(
        { error: "Source location not found" },
        { status: 404 }
      );
    }

    if (!toLocation || !toLocation.isActive) {
      return NextResponse.json(
        { error: "Destination location not found" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const sourceItems = await tx.inventoryItem.findMany({
        where: {
          medicationId: medication.id,
          locationId: fromLocation.id,
          status: "ACTIVE",
        },
        orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          lotNumber: true,
          expirationDate: true,
          quantityOnHand: true,
          status: true,
        },
      });

      const totalOnHand = sourceItems.reduce(
        (sum, item) => sum + Number(item.quantityOnHand),
        0
      );

      if (totalOnHand < numericQuantity) {
        throw new Error(`INSUFFICIENT_INVENTORY:${totalOnHand}`);
      }

      let remaining = numericQuantity;
      const transferLots: Array<{
        lotNumber: string | null;
        expirationDate: Date | null;
        quantity: number;
      }> = [];

      for (const item of sourceItems) {
        if (remaining <= 0) break;

        const itemQty = Number(item.quantityOnHand);
        if (!Number.isFinite(itemQty) || itemQty <= 0) continue;

        const deduction = Math.min(itemQty, remaining);
        const newQty = itemQty - deduction;

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantityOnHand: newQty.toString(),
            status: newQty <= 0 ? "DEPLETED" : item.status,
          },
        });

        transferLots.push({
          lotNumber: item.lotNumber,
          expirationDate: item.expirationDate,
          quantity: deduction,
        });

        remaining -= deduction;
      }

      if (remaining > 0) {
        throw new Error("INSUFFICIENT_INVENTORY:0");
      }

      for (const lot of transferLots) {
        await tx.inventoryItem.create({
          data: {
            locationId: toLocation.id,
            medicationId: medication.id,
            lotNumber: lot.lotNumber,
            expirationDate: lot.expirationDate,
            quantityOnHand: lot.quantity.toString(),
            status: "ACTIVE",
          },
        });
      }

      const prevHashOut = await getPreviousInventoryTransactionHash(tx);

      const createdOut = await tx.inventoryTransaction.create({
        data: {
          type: "TRANSFER_OUT",
          locationId: fromLocation.id,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: numericQuantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode: medication.barcode,
          note,
          previousHash: prevHashOut,
          chainVersion: 1,
        },
      });

      const hashOut = buildInventoryTransactionHash({
        id: createdOut.id,
        type: createdOut.type,
        locationId: createdOut.locationId,
        medicationId: createdOut.medicationId,
        actorUserId: createdOut.actorUserId,
        witnessUserId: createdOut.witnessUserId,
        quantity: createdOut.quantity,
        inventoryUnit: createdOut.inventoryUnit,
        lotNumber: createdOut.lotNumber,
        expirationDate: createdOut.expirationDate,
        barcode: createdOut.barcode,
        note: createdOut.note,
        referenceId: createdOut.referenceId,
        occurredAt: createdOut.occurredAt,
        previousHash: createdOut.previousHash,
        chainVersion: createdOut.chainVersion,
      });

      const updatedOut = await tx.inventoryTransaction.update({
        where: { id: createdOut.id },
        data: { hash: hashOut },
        select: {
          id: true,
          hash: true,
          occurredAt: true,
        },
      });

      const prevHashIn = await getPreviousInventoryTransactionHash(tx);

      const createdIn = await tx.inventoryTransaction.create({
        data: {
          type: "TRANSFER_IN",
          locationId: toLocation.id,
          medicationId: medication.id,
          actorUserId: actor.id,
          quantity: numericQuantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode: medication.barcode,
          note,
          previousHash: prevHashIn,
          chainVersion: 1,
        },
      });

      const hashIn = buildInventoryTransactionHash({
        id: createdIn.id,
        type: createdIn.type,
        locationId: createdIn.locationId,
        medicationId: createdIn.medicationId,
        actorUserId: createdIn.actorUserId,
        witnessUserId: createdIn.witnessUserId,
        quantity: createdIn.quantity,
        inventoryUnit: createdIn.inventoryUnit,
        lotNumber: createdIn.lotNumber,
        expirationDate: createdIn.expirationDate,
        barcode: createdIn.barcode,
        note: createdIn.note,
        referenceId: createdIn.referenceId,
        occurredAt: createdIn.occurredAt,
        previousHash: createdIn.previousHash,
        chainVersion: createdIn.chainVersion,
      });

      const updatedIn = await tx.inventoryTransaction.update({
        where: { id: createdIn.id },
        data: { hash: hashIn },
        select: {
          id: true,
          hash: true,
        },
      });

      return {
        outTx: updatedOut,
        inTx: updatedIn,
        lotsTransferred: transferLots.length,
      };
    });

    await logAuditEvent({
      occurredAt: result.outTx.occurredAt,
      category: "Inventory",
      action: "TRANSFER",
      actorUserId: actor.id,
      actorName: actor.name,
      locationId: fromLocation.id,
      locationName: fromLocation.name,
      medicationId: medication.id,
      medicationName: medication.name,
      inventoryTransactionId: result.outTx.id,
      entityType: "InventoryTransaction",
      entityId: result.outTx.id,
      details: buildInventoryAuditDetails({
        transactionType: "TRANSFER_OUT",
        quantity: numericQuantity,
        inventoryUnit: medication.inventoryUnit,
        deaSchedule: medication.deaSchedule,
        barcode: medication.barcode,
        note,
      }),
      metadata: {
        barcode: medication.barcode,
        fromLocationId: fromLocation.id,
        fromLocationName: fromLocation.name,
        toLocationId: toLocation.id,
        toLocationName: toLocation.name,
        quantity: numericQuantity,
        inventoryUnit: medication.inventoryUnit,
        note,
        transferOutTransactionHash: result.outTx.hash,
        transferInTransactionHash: result.inTx.hash,
        lotsTransferred: result.lotsTransferred,
      },
    });

    return NextResponse.json({
      success: true,
      transferOutTransactionId: result.outTx.id,
      transferInTransactionId: result.inTx.id,
      transferOutTransactionHash: result.outTx.hash,
      transferInTransactionHash: result.inTx.hash,
    });
  } catch (error) {
    console.error("POST /api/inventory/transfer error:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("INSUFFICIENT_INVENTORY:")
    ) {
      const onHand = error.message.split(":")[1] ?? "0";

      return NextResponse.json(
        { error: `Insufficient inventory. On hand: ${onHand}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Transfer failed" }, { status: 500 });
  }
}
