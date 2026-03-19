import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

export async function GET() {
  try {
    const medications = await prisma.medicationMaster.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ medications });
  } catch (error) {
    console.error("GET /api/medications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch medications" },
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Inactive user" }, { status: 403 });
    }

    const body = await req.json();

    const name = cleanString(body.name);
    const genericName = cleanString(body.genericName);
    const strength = cleanString(body.strength);
    const dosageForm = cleanString(body.dosageForm);
    const manufacturer = cleanString(body.manufacturer);
    const ndc = cleanString(body.ndc);
    const barcode = cleanString(body.barcode);
    const deaSchedule = cleanString(body.deaSchedule);
    const inventoryUnit = cleanString(body.inventoryUnit) || "EACH";
    const openedUsePolicy = cleanString(body.openedUsePolicy);
    const notes = cleanString(body.notes);

    const isMultiDose = cleanBoolean(body.isMultiDose);
    const requiresOpenedDate = cleanBoolean(body.requiresOpenedDate);
    const isActive =
      body.isActive === undefined ? true : cleanBoolean(body.isActive, true);

    const openedUseDays = cleanOptionalNumber(body.openedUseDays);
    if (Number.isNaN(openedUseDays)) {
      return NextResponse.json(
        { error: "Opened use days must be a valid number" },
        { status: 400 }
      );
    }

    if (!name || !barcode) {
      return NextResponse.json(
        { error: "Medication name and barcode are required" },
        { status: 400 }
      );
    }

    const normalizedDeaSchedule = deaSchedule?.toUpperCase() || null;
    const normalizedBarcode = barcode;
    const normalizedNdc = ndc;
    const derivedIsControlled = Boolean(normalizedDeaSchedule);
    const requiresWitnessWaste =
      normalizedDeaSchedule !== null
        ? true
        : cleanBoolean(body.requiresWitnessWaste);
    const isControlled =
      body.isControlled === undefined
        ? derivedIsControlled
        : cleanBoolean(body.isControlled, derivedIsControlled);

    const existingMedication = await prisma.medicationMaster.findUnique({
      where: { barcode: normalizedBarcode },
      select: { id: true },
    });

    if (existingMedication) {
      return NextResponse.json(
        { error: "A medication with this barcode already exists" },
        { status: 409 }
      );
    }

    const medication = await prisma.medicationMaster.create({
      data: {
        name,
        genericName,
        strength,
        dosageForm,
        manufacturer,
        ndc: normalizedNdc,
        barcode: normalizedBarcode,
        deaSchedule: normalizedDeaSchedule,
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

    return NextResponse.json({ medication }, { status: 201 });
  } catch (error) {
    console.error("POST /api/medications error:", error);
    return NextResponse.json(
      { error: "Failed to create medication" },
      { status: 500 }
    );
  }
}

