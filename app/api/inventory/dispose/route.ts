import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryTransactionHash,
  getPreviousInventoryTransactionHash,
} from "@/lib/ledger-hash";

type DisposeRequestBody = {
  barcode?: string;
  quantity?: number | string;
  locationId?: string;
  reasonCode?: string;
  note?: string;
  witnessName?: string;
  witnessUserId?: string;
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

    const body = (await req.json()) as DisposeRequestBody;

    const barcode = normalizeText(body?.barcode);
    const locationId = normalizeText(body?.locationId);
    const reasonCode = normalizeText(body?.reasonCode);
    const note = normalizeText(body?.note);
    const witnessName = normalizeText(body?.witnessName);
    const witnessUserId = normalizeText(body?.witnessUserId);

    const numericQuantity =
      typeof body?.quantity === "number"
        ? body.quantity
        : Number(body?.quantity);

    if (!barcode) {
      return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
    }

    if (!locationId) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return NextResponse.json(
        { error: "Valid disposal quantity is required" },
        { status: 400 }
      );
    }

    if (!reasonCode) {
      return NextResponse.json(
        { error: "Disposal reason is required" },
        { status: 400 }
      );
    }

    const medication = await prisma.medicationMaster.findFirst({
      where: {
        barcode,
        isActive: true,
      },
    });

    if (!medication) {
      return NextResponse.json(
        { error: "Medication not found for barcode" },
        { status: 404 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.isActive) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    let resolvedWitnessUserId: string | null = null;
    let resolvedWitnessName: string | null = null;

    const controlled = isControlledSubstance(medication.deaSchedule);

    if (controlled) {
      if (!witnessUserId && !witnessName) {
        return NextResponse.json(
          { error: "Witness is required for DEA scheduled medication disposal." },
          { status: 400 }
        );
      }

      if (witnessUserId) {
        const witnessUser = await prisma.user.findUnique({
          where: { id: witnessUserId },
        });

        if (!witnessUser || !witnessUser.isActive) {
          return NextResponse.json(
            { error: "Selected witness was not found or is inactive" },
            { status: 400 }
          );
        }

        if (witnessUser.id === actor.id) {
          return NextResponse.json(
            { error: "Witness cannot be the same user performing the disposal" },
            { status: 400 }
          );
        }

        resolvedWitnessUserId = witnessUser.id;
        resolvedWitnessName = witnessUser.name ?? null;
      } else {
        resolvedWitnessName = witnessName || null;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const inventoryItems = await tx.inventoryItem.findMany({
        where: {
          medicationId: medication.id,
          locationId,
          status: "ACTIVE",
        },
        orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
      });

      const totalOnHand = inventoryItems.reduce(
        (sum, item) => sum + Number(item.quantityOnHand ?? 0),
        0
      );

      if (totalOnHand < numericQuantity) {
        throw new Error(`INSUFFICIENT_INVENTORY:${totalOnHand}`);
      }

      let remainingToDispose = numericQuantity;
      const touchedItems: string[] = [];

      for (const item of inventoryItems) {
        if (remainingToDispose <= 0) break;

        const itemQty = Number(item.quantityOnHand ?? 0);
        if (itemQty <= 0) continue;

        const deduction = Math.min(itemQty, remainingToDispose);
        const newQty = itemQty - deduction;

        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            quantityOnHand: newQty.toString(),
            status: newQty <= 0 ? "DEPLETED" : item.status,
          },
        });

        touchedItems.push(item.id);
        remainingToDispose -= deduction;
      }

      const combinedNote = [
        `Reason: ${reasonCode}`,
        note || null,
        !resolvedWitnessUserId && resolvedWitnessName
          ? `Witness: ${resolvedWitnessName}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const previousHash = await getPreviousInventoryTransactionHash(tx);

      const createdTransaction = await tx.inventoryTransaction.create({
        data: {
          type: "DISPOSE",
          medicationId: medication.id,
          locationId,
          actorUserId: actor.id,
          witnessUserId: resolvedWitnessUserId,
          quantity: numericQuantity.toString(),
          inventoryUnit: medication.inventoryUnit,
          barcode,
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
      quantityDisposed: numericQuantity,
      inventoryItemsUpdated: result.touchedItems.length,
      transactionId: result.transaction.id,
      transactionHash: result.transaction.hash,
    });
  } catch (error) {
    console.error("POST /api/inventory/dispose error:", error);

    if (error instanceof Error) {
      if (error.message.startsWith("INSUFFICIENT_INVENTORY:")) {
        const onHand = error.message.split(":")[1] ?? "0";

        return NextResponse.json(
          { error: `Insufficient inventory. On hand: ${onHand}` },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to dispose medication" },
      { status: 500 }
    );
  }
}
