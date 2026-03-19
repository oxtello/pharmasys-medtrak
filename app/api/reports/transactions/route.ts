import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const locationId = (searchParams.get("locationId") || "").trim();
    const type = (searchParams.get("type") || "").trim();
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const startDate = (searchParams.get("startDate") || "").trim();
    const endDate = (searchParams.get("endDate") || "").trim();

    const where: any = {};

    if (locationId) {
      where.locationId = locationId;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.occurredAt = {};

      if (startDate) {
        where.occurredAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        where.occurredAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: {
        occurredAt: "desc",
      },
      include: {
        medication: true,
        location: true,
        actor: true,
      },
      take: 500,
    });

    const formatted = transactions
      .map((tx) => ({
        id: tx.id,
        occurredAt: tx.occurredAt,
        type: String(tx.type),
        medicationName:
          (tx.medication as any)?.medicationName ||
          (tx.medication as any)?.name ||
          "Unknown medication",
        strength: String((tx.medication as any)?.strength || ""),
        dosageForm: String((tx.medication as any)?.dosageForm || ""),
        manufacturer: String((tx.medication as any)?.manufacturer || ""),
        barcode: String(tx.barcode || ""),
        ndc: String((tx.medication as any)?.ndc || ""),
        locationId: String(tx.locationId || ""),
        locationName: String((tx.location as any)?.name || ""),
        quantity: Number(tx.quantity || 0),
        inventoryUnit: String(
          tx.inventoryUnit || (tx.medication as any)?.inventoryUnit || ""
        ),
        deaSchedule: String((tx.medication as any)?.deaSchedule || ""),
        actorName: String(
          (tx.actor as any)?.name ||
            (tx.actor as any)?.email ||
            "Unknown user"
        ),
        note: String(tx.note || ""),
        referenceId: String((tx as any).referenceId || tx.id),
      }))
      .filter((row) => {
        if (!search) return true;

        return [
          row.type,
          row.medicationName,
          row.strength,
          row.dosageForm,
          row.manufacturer,
          row.barcode,
          row.ndc,
          row.locationName,
          row.deaSchedule,
          row.actorName,
          row.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      });

    return NextResponse.json({
      transactions: formatted,
    });
  } catch (error) {
    console.error("Transactions report error:", error);

    return NextResponse.json(
      { error: "Failed to load transactions report" },
      { status: 500 }
    );
  }
}
