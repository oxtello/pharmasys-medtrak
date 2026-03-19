import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CycleCountMetadata = {
  barcode?: string;
  expectedCount?: number;
  actualCount?: number;
  variance?: number;
  inventoryUnit?: string;
  comment?: string | null;
  deaSchedule?: string | null;
};

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseMetadataJson(value?: string | null): CycleCountMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as CycleCountMetadata)
      : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const locationId = searchParams.get("locationId") || "";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const countedBy = (searchParams.get("countedBy") || "").trim().toLowerCase();
    const deaSchedule = (searchParams.get("deaSchedule") || "").trim().toUpperCase();
    const discrepancyOnly = searchParams.get("discrepancyOnly") === "true";
    const startDateRaw = searchParams.get("startDate") || "";
    const endDateRaw = searchParams.get("endDate") || "";

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = startDateRaw
      ? startOfDay(startDateRaw)
      : new Date(defaultStart.setHours(0, 0, 0, 0));

    const endDate = endDateRaw
      ? endOfDay(endDateRaw)
      : new Date(now.setHours(23, 59, 59, 999));

    const rows = await prisma.auditEvent.findMany({
      where: {
        action: "CYCLE_COUNT",
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(locationId ? { locationId } : {}),
      },
      orderBy: {
        occurredAt: "desc",
      },
    });

    const normalized = rows
      .map((event) => {
        const metadata = parseMetadataJson(event.metadataJson);

        return {
          id: event.id,
          occurredAt: event.occurredAt.toISOString(),
          medicationName: event.medicationName || "",
          strength: null,
          dosageForm: null,
          barcode: metadata.barcode || null,
          deaSchedule: metadata.deaSchedule || null,
          locationId: event.locationId || null,
          locationName: event.locationName || "",
          expectedCount: toNumber(metadata.expectedCount),
          actualCount: toNumber(metadata.actualCount),
          variance: toNumber(metadata.variance),
          comment: metadata.comment || "",
          countedBy: event.actorName || null,
          inventoryUnit: metadata.inventoryUnit || null,
        };
      })
      .filter((row) => {
        const medicationText = [
          row.medicationName,
          row.strength,
          row.dosageForm,
          row.barcode,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const countedByText = String(row.countedBy || "").toLowerCase();
        const rowSchedule = String(row.deaSchedule || "").toUpperCase();

        const matchesSearch = !search || medicationText.includes(search);
        const matchesCountedBy = !countedBy || countedByText.includes(countedBy);
        const matchesSchedule =
          !deaSchedule || rowSchedule === deaSchedule;
        const matchesDiscrepancy =
          !discrepancyOnly || toNumber(row.variance) !== 0;

        return (
          matchesSearch &&
          matchesCountedBy &&
          matchesSchedule &&
          matchesDiscrepancy
        );
      });

    return NextResponse.json({ rows: normalized });
  } catch (error) {
    console.error("Failed to load variance review", error);
    return NextResponse.json(
      { error: "Failed to load variance review" },
      { status: 500 }
    );
  }
}
