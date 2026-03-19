import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        medication: true,
        location: true,
      },
      orderBy: [
        { medication: { name: "asc" } },
        { createdAt: "desc" },
      ],
    });

    const grouped = new Map<
      string,
      {
        medicationId: string;
        barcode: string;
        name: string;
        strength: string;
        dosageForm: string;
        ndc: string;
        inventoryUnit: string;
        locationId: string;
        locationName: string;
        quantity: number;
      }
    >();

    for (const item of items) {
      const key = `${item.locationId}__${item.medicationId}`;
      const quantity = Number(item.quantityOnHand ?? 0);

      if (!grouped.has(key)) {
        grouped.set(key, {
          medicationId: item.medicationId,
          barcode: item.medication.barcode ?? "",
          name: item.medication.name ?? "",
          strength: item.medication.strength ?? "",
          dosageForm: item.medication.dosageForm ?? "",
          ndc: item.medication.ndc ?? "",
          inventoryUnit: String(item.medication.inventoryUnit ?? "EACH"),
          locationId: item.locationId,
          locationName: item.location.name ?? "",
          quantity,
        });
      } else {
        const existing = grouped.get(key)!;
        existing.quantity += quantity;
      }
    }

    const inventory = Array.from(grouped.values()).map((item) => ({
      ...item,
      quantity: Number(item.quantity.toFixed(3)),
      status:
        item.quantity <= 0
          ? "OUT"
          : item.quantity <= 10
          ? "CRITICAL"
          : item.quantity <= 25
          ? "LOW"
          : "HEALTHY",
    }));

    return NextResponse.json({
      inventory,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load inventory" },
      { status: 500 }
    );
  }
}
