import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_INVENTORY_UNITS = [
  "EACH",
  "ML",
  "TABLET",
  "CAPSULE",
  "VIAL",
  "AMPULE",
  "TUBE",
  "BOTTLE",
  "PATCH",
  "SYRINGE",
  "KIT",
  "GRAM",
] as const;

type InventoryUnitValue = (typeof ALLOWED_INVENTORY_UNITS)[number];

function cleanString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function cleanOptionalNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeInventoryUnit(value: unknown): InventoryUnitValue {
  if (typeof value !== "string") return "EACH";
  const normalized = value.trim().toUpperCase() as InventoryUnitValue;
  return ALLOWED_INVENTORY_UNITS.includes(normalized) ? normalized : "EACH";
}

export async function GET() {
  try {
    const medications = await prisma.medicationMaster.findMany({
      orderBy: [{ name: "asc" }, { strength: "asc" }],
    });

    return NextResponse.json({ medications });
  } catch (error) {
    console.error("Failed to load medications", error);
    return NextResponse.json(
      { error: "Failed to load medications" },
      { status: 500 }
    );
  }
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
        email: true,
        isActive: true,
      },
    });

    if (!actor || !actor.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const name = cleanString(body?.name);
    const genericName = cleanString(body?.genericName);
    const strength = cleanString(body?.strength);
    const dosageForm = cleanString(body?.dosageForm);
    const manufacturer = cleanString(body?.manufacturer);
    const ndc = cleanString(body?.ndc);
    const barcode = cleanString(body?.barcode);
    const deaSchedule = cleanString(body?.deaSchedule);
    const inventoryUnit = normalizeInventoryUnit(body?.inventoryUnit);
    const isControlled = cleanBoolean(body?.isControlled, false);
    const isActive = cleanBoolean(body?.isActive, true);
    const isMultiDose = cleanBoolean(body?.isMultiDose, false);
    const openedUsePolicy = cleanString(body?.openedUsePolicy);
    const openedUseDays = cleanOptionalNumber(body?.openedUseDays);
    const requiresOpenedDate = cleanBoolean(body?.requiresOpenedDate, false);
    const requiresWitnessWaste = cleanBoolean(
      body?.requiresWitnessWaste,
      false
    );
    const notes = cleanString(body?.notes);

    if (!name) {
      return NextResponse.json(
        { error: "Medication name is required" },
        { status: 400 }
      );
    }

    if (openedUseDays !== null && Number.isNaN(openedUseDays)) {
      return NextResponse.json(
        { error: "Opened use days must be a valid number" },
        { status: 400 }
      );
    }

    if (barcode) {
      const existingBarcode = await prisma.medicationMaster.findFirst({
        where: { barcode },
        select: { id: true, name: true },
      });

      if (existingBarcode) {
        return NextResponse.json(
          { error: "A medication with that barcode already exists" },
          { status: 409 }
        );
      }
    }

    const createdMedication = await prisma.medicationMaster.create({
      data: {
        name,
        genericName,
        strength,
        dosageForm,
        manufacturer,
        ndc,
        barcode,
        deaSchedule,
        inventoryUnit,
        isControlled,
        isActive,
        isMultiDose,
        openedUsePolicy,
        openedUseDays,
        requiresOpenedDate,
        requiresWitnessWaste,
        notes,
      },
    });

    return NextResponse.json({ medication: createdMedication }, { status: 201 });
  } catch (error) {
    console.error("Failed to create medication", error);
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 }
    );
  }
}
