import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cleanString(value: string | null) {
  return (value || "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = cleanString(searchParams.get("locationId"));
    const barcode = cleanString(searchParams.get("barcode"));
    const search = cleanString(searchParams.get("search")).toLowerCase();

    const items = await prisma.inventoryItem.findMany({
      where: {
        ...(locationId ? { locationId } : {}),
        status: "ACTIVE",
        location: { isActive: true },
        medication: {
          isActive: true,
          ...(barcode ? { barcode } : {}),
        },
      },
      include: {
        medication: true,
        location: true,
      },
      orderBy: [
        { expirationDate: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (barcode && locationId) {
      const matchingItems = items.filter((item) => {
        const qty = toNumber(item.quantityOnHand);
        return qty > 0;
      });

      if (matchingItems.length === 0) {
        return NextResponse.json(
          { error: "Inventory not found for that barcode at the selected location" },
          { status: 404 }
        );
      }

      const first = matchingItems[0];
      const onHand = matchingItems.reduce(
        (sum, item) => sum + toNumber(item.quantityOnHand),
        0
      );

      return NextResponse.json({
        medication: {
          id: first.medicationId,
          name: first.medication?.name ?? "Unknown medication",
          strength: first.medication?.strength ?? null,
          dosageForm: first.medication?.dosageForm ?? null,
          manufacturer: first.medication?.manufacturer ?? null,
          barcode: first.medication?.barcode ?? null,
          ndc: first.medication?.ndc ?? null,
          deaSchedule: first.medication?.deaSchedule ?? null,
          inventoryUnit: first.medication?.inventoryUnit
            ? String(first.medication.inventoryUnit)
            : null,
        },
        location: {
          id: first.locationId,
          name: first.location?.name ?? "Unknown location",
          code: first.location?.code ?? null,
        },
        onHand,
        inventoryUnit: first.medication?.inventoryUnit
          ? String(first.medication.inventoryUnit)
          : "",
      });
    }

    const rowsMap = new Map<
      string,
      {
        medicationId: string;
        medicationName: string;
        strength: string | null;
        dosageForm: string | null;
        manufacturer: string | null;
        barcode: string | null;
        ndc: string | null;
        deaSchedule: string | null;
        inventoryUnit: string | null;
        locationId: string;
        locationName: string;
        quantityOnHand: number;
      }
    >();

    for (const item of items) {
      const haystack = [
        item.medication?.name,
        item.medication?.barcode,
        item.medication?.ndc,
        item.medication?.manufacturer,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !haystack.includes(search)) continue;

      const qty = toNumber(item.quantityOnHand);
      if (qty <= 0) continue;

      const key = `${item.medicationId}:${item.locationId}`;

      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          medicationId: item.medicationId,
          medicationName: item.medication?.name ?? "Unknown medication",
          strength: item.medication?.strength ?? null,
          dosageForm: item.medication?.dosageForm ?? null,
          manufacturer: item.medication?.manufacturer ?? null,
          barcode: item.medication?.barcode ?? null,
          ndc: item.medication?.ndc ?? null,
          deaSchedule: item.medication?.deaSchedule ?? null,
          inventoryUnit: item.medication?.inventoryUnit
            ? String(item.medication.inventoryUnit)
            : null,
          locationId: item.locationId,
          locationName: item.location?.name ?? "Unknown location",
          quantityOnHand: 0,
        });
      }

      rowsMap.get(key)!.quantityOnHand += qty;
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => {
      const byMedication = a.medicationName.localeCompare(b.medicationName);
      if (byMedication !== 0) return byMedication;
      return a.locationName.localeCompare(b.locationName);
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("On-hand inventory API error:", error);
    return NextResponse.json(
      { error: "Failed to load on-hand inventory" },
      { status: 500 }
    );
  }
}
