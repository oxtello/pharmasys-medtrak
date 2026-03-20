import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = (searchParams.get("barcode") || "").trim();

    if (!barcode) {
      return NextResponse.json(
        { error: "Barcode is required" },
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

    const isMultiDose = Boolean(medication.isMultiDose);
    const openedUsePolicy =
      medication.openedUsePolicy ||
      (isMultiDose ? "DAYS_AFTER_OPEN" : "SINGLE_USE");
    const openedUseDays =
      openedUsePolicy === "DAYS_AFTER_OPEN"
        ? medication.openedUseDays ?? 28
        : null;
    const requiresOpenedDate =
      openedUsePolicy === "DAYS_AFTER_OPEN"
        ? medication.requiresOpenedDate ?? true
        : false;
    const requiresContainerTracking =
      openedUsePolicy === "DAYS_AFTER_OPEN" ? true : false;

    return NextResponse.json({
      medication: {
        ...medication,
        medicationName: medication.name,
        isMultidose: isMultiDose,
        isMultiDose,
        openedUsePolicy,
        openedUseDays,
        requiresOpenedDate,
        requiresContainerTracking,
      },
    });
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return NextResponse.json(
      { error: "Failed to lookup medication" },
      { status: 500 }
    );
  }
}
