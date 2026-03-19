import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReconciliationRow = {
  medicationId: string;
  medicationName: string;
  strength?: string | null;
  dosageForm?: string | null;
  deaSchedule?: string | null;
  locationId: string;
  locationName: string;
  beginningBalance: number;
  receipts: number;
  transfersIn: number;
  dispensed: number;
  waste: number;
  dispose: number;
  transfersOut: number;
  adjustments: number;
  expectedEndingBalance: number;
  physicalCount: number | null;
  variance: number | null;
  countedBy?: string | null;
  notes?: string | null;
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function startOfDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}

function rowKey(medicationId: string, locationId: string) {
  return `${medicationId}__${locationId}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const locationId = searchParams.get("locationId") || "";
    const search = searchParams.get("search") || "";
    const startDateRaw = searchParams.get("startDate") || "";
    const endDateRaw = searchParams.get("endDate") || "";
    const deaSchedulesRaw = searchParams.get("deaSchedules") || "";

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = startDateRaw
      ? startOfDay(startDateRaw)
      : new Date(defaultStart.setHours(0, 0, 0, 0));

    const endDate = endDateRaw
      ? endOfDay(endDateRaw)
      : new Date(now.setHours(23, 59, 59, 999));

    const deaSchedules = deaSchedulesRaw
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const medicationWhere = {
      isActive: true,
      ...(deaSchedules.length
        ? { deaSchedule: { in: deaSchedules } }
        : {}),
      ...(search.trim()
        ? {
            OR: [
              {
                name: {
                  contains: search.trim(),
                  mode: "insensitive" as const,
                },
              },
              {
                genericName: {
                  contains: search.trim(),
                  mode: "insensitive" as const,
                },
              },
              {
                barcode: {
                  contains: search.trim(),
                },
              },
              {
                ndc: {
                  contains: search.trim(),
                },
              },
            ],
          }
        : {}),
    };

    const txWhereBase = {
      ...(locationId ? { locationId } : {}),
      medication: medicationWhere,
    };

    const [beforeTx, periodTx, cycleCountTx] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: {
          ...txWhereBase,
          occurredAt: { lt: startDate },
        },
        include: {
          medication: true,
          location: true,
          actor: true,
        },
        orderBy: { occurredAt: "asc" },
      }),

      prisma.inventoryTransaction.findMany({
        where: {
          ...txWhereBase,
          occurredAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          medication: true,
          location: true,
          actor: true,
        },
        orderBy: { occurredAt: "asc" },
      }),

      prisma.inventoryTransaction.findMany({
        where: {
          ...txWhereBase,
          type: "CYCLE_COUNT",
          occurredAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          medication: true,
          location: true,
          actor: true,
        },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    const rows = new Map<string, ReconciliationRow>();

    function ensureRow(tx: (typeof periodTx)[number] | (typeof beforeTx)[number]) {
      const key = rowKey(tx.medicationId, tx.locationId);

      if (!rows.has(key)) {
        rows.set(key, {
          medicationId: tx.medicationId,
          medicationName: tx.medication?.name ?? "",
          strength: tx.medication?.strength ?? null,
          dosageForm: tx.medication?.dosageForm ?? null,
          deaSchedule: tx.medication?.deaSchedule ?? null,
          locationId: tx.locationId,
          locationName: tx.location?.name ?? "",
          beginningBalance: 0,
          receipts: 0,
          transfersIn: 0,
          dispensed: 0,
          waste: 0,
          dispose: 0,
          transfersOut: 0,
          adjustments: 0,
          expectedEndingBalance: 0,
          physicalCount: null,
          variance: null,
          countedBy: null,
          notes: null,
        });
      }

      return rows.get(key)!;
    }

    function signedQuantity(type: string, quantity: number) {
      switch (type) {
        case "RECEIVE":
        case "TRANSFER_IN":
          return quantity;
        case "DISPENSE":
        case "WASTE":
        case "DISPOSE":
        case "TRANSFER_OUT":
          return -quantity;
        case "ADJUST":
          return quantity;
        default:
          return 0;
      }
    }

    for (const tx of beforeTx) {
      const row = ensureRow(tx);
      const qty = toNumber(tx.quantity);
      row.beginningBalance += signedQuantity(tx.type, qty);
    }

    for (const tx of periodTx) {
      const row = ensureRow(tx);
      const qty = toNumber(tx.quantity);

      switch (tx.type) {
        case "RECEIVE":
          row.receipts += qty;
          break;
        case "TRANSFER_IN":
          row.transfersIn += qty;
          break;
        case "DISPENSE":
          row.dispensed += qty;
          break;
        case "WASTE":
          row.waste += qty;
          break;
        case "DISPOSE":
          row.dispose += qty;
          break;
        case "TRANSFER_OUT":
          row.transfersOut += qty;
          break;
        case "ADJUST":
          row.adjustments += qty;
          break;
        default:
          break;
      }
    }

    for (const tx of cycleCountTx) {
      const row = ensureRow(tx);

      if (row.physicalCount !== null) continue;

      row.physicalCount = toNumber(tx.quantity);
      row.countedBy = tx.actor?.name ?? null;
      row.notes = tx.note ?? null;
    }

    const finalRows = Array.from(rows.values())
      .map((row) => {
        row.expectedEndingBalance =
          row.beginningBalance +
          row.receipts +
          row.transfersIn -
          row.dispensed -
          row.waste -
          row.dispose -
          row.transfersOut +
          row.adjustments;

        row.variance =
          row.physicalCount === null
            ? null
            : row.physicalCount - row.expectedEndingBalance;

        return row;
      })
      .sort((a, b) => {
        if (a.locationName !== b.locationName) {
          return a.locationName.localeCompare(b.locationName);
        }
        return a.medicationName.localeCompare(b.medicationName);
      });

    return NextResponse.json({ rows: finalRows });
  } catch (error) {
    console.error("Failed to build reconciliation report", error);
    return NextResponse.json(
      { error: "Failed to build reconciliation report" },
      { status: 500 }
    );
  }
}
