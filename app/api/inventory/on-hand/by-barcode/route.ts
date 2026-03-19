import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get("barcode")?.trim();
    const locationId = searchParams.get("locationId")?.trim();

    if (!barcode) {
      return NextResponse.json(
        { error: "Barcode is required." },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { error: "Location is required." },
        { status: 400 }
      );
    }

    const medication = await prisma.medicationMaster.findUnique({
      where: { barcode },
    });

    if (!medication) {
      return NextResponse.json(
        { error: "Medication not found for this barcode." },
        { status: 404 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found." },
        { status: 404 }
      );
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        medicationId: medication.id,
        locationId,
      },
      orderBy: {
        occurredAt: "asc",
      },
    });

    let onHand = 0;

    for (const tx of transactions) {
      const qty = Number(tx.quantity);

      switch (tx.type) {
        case "RECEIVE":
        case "TRANSFER_IN":
          onHand += qty;
          break;
        case "DISPENSE":
        case "TRANSFER_OUT":
        case "WASTE":
        case "DISPOSE":
          onHand -= qty;
          break;
        case "ADJUST":
          onHand += qty;
          break;
        case "CYCLE_COUNT":
          break;
        default:
          break;
      }
    }

    return NextResponse.json({
      medication: {
        id: medication.id,
        name: medication.name,
        strength: medication.strength,
        dosageForm: medication.dosageForm,
        manufacturer: medication.manufacturer,
        barcode: medication.barcode,
        deaSchedule: medication.deaSchedule,
        inventoryUnit: medication.inventoryUnit,
      },
      location: {
        id: location.id,
        name: location.name,
        code: location.code,
      },
      onHand,
      inventoryUnit: medication.inventoryUnit,
    });
  } catch (error) {
    console.error("Failed to load expected count by barcode", error);
    return NextResponse.json(
      { error: "Failed to load expected count." },
      { status: 500 }
    );
  }
}
