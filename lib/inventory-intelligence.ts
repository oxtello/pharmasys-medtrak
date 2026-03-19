export type InventoryStatus = "Healthy" | "Low" | "Critical";

export type UsageSnapshot = {
  dispensed30: number;
  dispensed60: number;
  dispensed90: number;
  weightedDailyUsage: number;
  daysOfSupply: number | null;
  reorderPoint: number;
  criticalPoint: number;
  parLevel: number;
  status: InventoryStatus;
};

type DispenseLikeRecord = {
  barcode?: string;
  location?: string;
  quantity?: string | number;
  timestamp?: string;
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDayOrAfter(value: string | undefined, cutoff: Date) {
  const date = toDate(value);
  if (!date) return false;
  return date.getTime() >= cutoff.getTime();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Dynamic learning model
 *
 * The system learns from 30 / 60 / 90 day dispense history:
 * - 30d gets the highest weight because it reflects recent demand
 * - 60d helps stabilize short-term spikes
 * - 90d helps smooth longer trends
 *
 * Then it calculates:
 * - weighted daily usage
 * - reorder point (lead time demand)
 * - critical point (urgent replenish threshold)
 * - par level (lead time + safety stock)
 */
export function buildUsageSnapshot(params: {
  barcode: string;
  location: string;
  onHandQuantity: number;
  dispenses: DispenseLikeRecord[];
  leadDays?: number;
  safetyDays?: number;
  criticalDays?: number;
  minParLevel?: number;
  minCriticalLevel?: number;
}): UsageSnapshot {
  const {
    barcode,
    location,
    onHandQuantity,
    dispenses,
    leadDays = 14,
    safetyDays = 7,
    criticalDays = 3,
    minParLevel = 5,
    minCriticalLevel = 2,
  } = params;

  const now = new Date();

  const cutoff30 = new Date(now);
  cutoff30.setDate(now.getDate() - 30);

  const cutoff60 = new Date(now);
  cutoff60.setDate(now.getDate() - 60);

  const cutoff90 = new Date(now);
  cutoff90.setDate(now.getDate() - 90);

  const matching = dispenses.filter(
    (item) =>
      String(item.barcode || "").trim() === barcode &&
      String(item.location || "").trim() === location
  );

  let dispensed30 = 0;
  let dispensed60 = 0;
  let dispensed90 = 0;

  for (const item of matching) {
    const qty = Math.abs(toNumber(item.quantity));

    if (sameDayOrAfter(item.timestamp, cutoff90)) {
      dispensed90 += qty;
    }
    if (sameDayOrAfter(item.timestamp, cutoff60)) {
      dispensed60 += qty;
    }
    if (sameDayOrAfter(item.timestamp, cutoff30)) {
      dispensed30 += qty;
    }
  }

  const daily30 = dispensed30 / 30;
  const daily60 = dispensed60 / 60;
  const daily90 = dispensed90 / 90;

  // weighted learning model
  const weightedDailyUsage =
    daily30 * 0.5 +
    daily60 * 0.3 +
    daily90 * 0.2;

  const normalizedDailyUsage =
    weightedDailyUsage > 0 ? weightedDailyUsage : 0;

  const reorderPoint = Math.max(
    minCriticalLevel,
    Math.ceil(normalizedDailyUsage * leadDays)
  );

  const criticalPoint = Math.max(
    minCriticalLevel,
    Math.ceil(normalizedDailyUsage * criticalDays)
  );

  const parLevel = Math.max(
    minParLevel,
    Math.ceil(normalizedDailyUsage * (leadDays + safetyDays))
  );

  const daysOfSupply =
    normalizedDailyUsage > 0
      ? round2(onHandQuantity / normalizedDailyUsage)
      : null;

  let status: InventoryStatus = "Healthy";

  if (onHandQuantity <= criticalPoint) {
    status = "Critical";
  } else if (onHandQuantity <= reorderPoint) {
    status = "Low";
  }

  return {
    dispensed30: round2(dispensed30),
    dispensed60: round2(dispensed60),
    dispensed90: round2(dispensed90),
    weightedDailyUsage: round2(normalizedDailyUsage),
    daysOfSupply,
    reorderPoint,
    criticalPoint,
    parLevel,
    status,
  };
}
