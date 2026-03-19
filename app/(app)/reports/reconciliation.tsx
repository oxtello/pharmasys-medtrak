"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DeaSchedule = "C2" | "C3" | "C4" | "C5";

type SavedReceiveRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  lotNumber?: string;
  expirationDate?: string;
  location: string;
  quantityReceived: string;
  unit?: string;
  supplier?: string;
  notes?: string;
  deaSchedule?: string;
  receivedAt?: string;
};

type SavedDispenseRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  patient?: string;
  encounterId?: string;
  location: string;
  quantity: string;
  notes?: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedAdjustRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  adjustmentType: "ADD" | "SUBTRACT";
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedWasteRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  timestamp?: string;
};

type SavedDisposeRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  quantity: string;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  timestamp?: string;
};

type SavedTransferRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  fromLocation: string;
  toLocation: string;
  quantity: string;
  notes?: string;
  deaSchedule?: string;
  timestamp?: string;
};

type SavedCycleCountRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location: string;
  expectedQuantity: string;
  actualQuantity: string;
  variance: string;
  notes?: string;
  deaSchedule?: string;
  countedBy?: string;
  timestamp?: string;
};

type ReconciliationDraft = {
  physicalCount: string;
  reconciledBy: string;
  reconciledDate: string;
  notes: string;
};

type ReportRow = {
  key: string;
  barcode: string;
  ndc: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  location: string;
  deaSchedule: DeaSchedule;
  beginningBalance: number;
  receipts: number;
  transfersIn: number;
  dispensed: number;
  wasted: number;
  disposed: number;
  transfersOut: number;
  adjustments: number;
  expectedEndingBalance: number;
  physicalCount: string;
  reconciledBy: string;
  reconciledDate: string;
  notes: string;
};

const SCHEDULE_OPTIONS: DeaSchedule[] = ["C2", "C3", "C4", "C5"];
const RECON_STORAGE_KEY = "medtrak-reconciliation-report";

function safeRead<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function safeReadObject<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeDea(value?: string | null): DeaSchedule | null {
  const normalized = String(value || "").trim().toUpperCase();
  return SCHEDULE_OPTIONS.includes(normalized as DeaSchedule)
    ? (normalized as DeaSchedule)
    : null;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInDateRange(
  value: string | undefined,
  startDate: string,
  endDate: string
): boolean {
  const date = parseDate(value);
  if (!date) return false;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (date.getTime() < start.getTime()) return false;
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    if (date.getTime() > end.getTime()) return false;
  }

  return true;
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function scheduleBadgeClass(schedule: DeaSchedule) {
  switch (schedule) {
    case "C2":
      return "bg-rose-100 text-rose-700";
    case "C3":
      return "bg-amber-100 text-amber-700";
    case "C4":
      return "bg-blue-100 text-blue-700";
    case "C5":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function varianceBadgeClass(variance: number) {
  if (variance === 0) return "bg-emerald-100 text-emerald-700";
  if (variance > 0) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function ReconciliationReportPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<DeaSchedule[]>([
    "C2",
    "C3",
    "C4",
    "C5",
  ]);
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReconciliationDraft>>({});

  useEffect(() => {
    setMounted(true);
    setDrafts(safeReadObject<Record<string, ReconciliationDraft>>(RECON_STORAGE_KEY, {}));
  }, []);

  function saveDrafts(next: Record<string, ReconciliationDraft>) {
    setDrafts(next);
    localStorage.setItem(RECON_STORAGE_KEY, JSON.stringify(next));
  }

  function updateReconciliation(
    key: string,
    field: keyof ReconciliationDraft,
    value: string
  ) {
    const next: Record<string, ReconciliationDraft> = {
      ...drafts,
      [key]: {
        physicalCount: drafts[key]?.physicalCount ?? "",
        reconciledBy: drafts[key]?.reconciledBy ?? "",
        reconciledDate: drafts[key]?.reconciledDate ?? "",
        notes: drafts[key]?.notes ?? "",
        [field]: value,
      },
    };

    saveDrafts(next);
  }

  function toggleSchedule(schedule: DeaSchedule) {
    setSelectedSchedules((prev) =>
      prev.includes(schedule)
        ? prev.filter((item) => item !== schedule)
        : [...prev, schedule]
    );
  }

  function selectAllSchedules() {
    setSelectedSchedules([...SCHEDULE_OPTIONS]);
  }

  function clearSchedules() {
    setSelectedSchedules([]);
  }

  const reportData = useMemo(() => {
    if (!mounted) {
      return {
        rows: [] as ReportRow[],
        locations: [] as string[],
      };
    }

    const receives = safeRead<SavedReceiveRecord>("medtrak-received-stock");
    const dispenses = safeRead<SavedDispenseRecord>("medtrak-dispense-log");
    const adjusts = safeRead<SavedAdjustRecord>("medtrak-adjust-log");
    const wastes = safeRead<SavedWasteRecord>("medtrak-waste-log");
    const disposes = safeRead<SavedDisposeRecord>("medtrak-dispose-log");
    const transfers = safeRead<SavedTransferRecord>("medtrak-transfer-log");
    const cycleCounts = safeRead<SavedCycleCountRecord>("medtrak-cycle-count-log");

    const map = new Map<string, Omit<ReportRow, "physicalCount" | "reconciledBy" | "reconciledDate" | "notes">>();

    function ensureRow(base: {
      barcode?: string;
      ndc?: string;
      medicationName?: string;
      strength?: string;
      dosageForm?: string;
      manufacturer?: string;
      location?: string;
      deaSchedule?: string | null;
    }) {
      const schedule = normalizeDea(base.deaSchedule);
      if (!schedule) return null;

      const barcode = base.barcode || "";
      const location = base.location || "Unknown";
      const key = `${barcode}__${location}__${schedule}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          barcode,
          ndc: base.ndc || "",
          medicationName: base.medicationName || "Unknown medication",
          strength: base.strength || "",
          dosageForm: base.dosageForm || "",
          manufacturer: base.manufacturer || "",
          location,
          deaSchedule: schedule,
          beginningBalance: 0,
          receipts: 0,
          transfersIn: 0,
          dispensed: 0,
          wasted: 0,
          disposed: 0,
          transfersOut: 0,
          adjustments: 0,
          expectedEndingBalance: 0,
        });
      }

      const row = map.get(key)!;
      if (!row.ndc && base.ndc) row.ndc = base.ndc;
      if (!row.medicationName && base.medicationName) row.medicationName = base.medicationName;
      if (!row.strength && base.strength) row.strength = base.strength;
      if (!row.dosageForm && base.dosageForm) row.dosageForm = base.dosageForm;
      if (!row.manufacturer && base.manufacturer) row.manufacturer = base.manufacturer;

      return row;
    }

    receives.forEach((item) => {
      const row = ensureRow(item);
      if (!row) return;

      const qty = toNumber(item.quantityReceived);
      if (isInDateRange(item.receivedAt, startDate, endDate)) {
        row.receipts += qty;
      } else {
        row.beginningBalance += qty;
      }
    });

    dispenses.forEach((item) => {
      const row = ensureRow(item);
      if (!row) return;

      const qty = toNumber(item.quantity);
      if (isInDateRange(item.timestamp, startDate, endDate)) {
        row.dispensed += qty;
      } else {
        row.beginningBalance -= qty;
      }
    });

    adjusts.forEach((item) => {
      const row = ensureRow(item);
      if (!row) return;

      const qty = toNumber(item.quantity);
      const signedQty = item.adjustmentType === "ADD" ? qty : -qty;

      if (isInDateRange(item.timestamp, startDate, endDate)) {
        row.adjustments += signedQty;
      } else {
        row.beginningBalance += signedQty;
      }
    });

    wastes.forEach((item) => {
      const row = ensureRow(item);
      if (!row) return;

      const qty = toNumber(item.quantity);
      if (isInDateRange(item.timestamp, startDate, endDate)) {
        row.wasted += qty;
      } else {
        row.beginningBalance -= qty;
      }
    });

    disposes.forEach((item) => {
      const row = ensureRow(item);
      if (!row) return;

      const qty = toNumber(item.quantity);
      if (isInDateRange(item.timestamp, startDate, endDate)) {
        row.disposed += qty;
      } else {
        row.beginningBalance -= qty;
      }
    });

    transfers.forEach((item) => {
      const schedule = normalizeDea(item.deaSchedule);
      if (!schedule) return;

      const outRow = ensureRow({
        ...item,
        location: item.fromLocation,
        deaSchedule: schedule,
      });
      const inRow = ensureRow({
        ...item,
        location: item.toLocation,
        deaSchedule: schedule,
      });

      const qty = toNumber(item.quantity);

      if (outRow) {
        if (isInDateRange(item.timestamp, startDate, endDate)) {
          outRow.transfersOut += qty;
        } else {
          outRow.beginningBalance -= qty;
        }
      }

      if (inRow) {
        if (isInDateRange(item.timestamp, startDate, endDate)) {
          inRow.transfersIn += qty;
        } else {
          inRow.beginningBalance += qty;
        }
      }
    });

    const latestCycleCountByKey = new Map<string, SavedCycleCountRecord>();

    cycleCounts.forEach((item) => {
      const schedule = normalizeDea(item.deaSchedule);
      if (!schedule) return;

      const key = `${item.barcode || ""}__${item.location || "Unknown"}__${schedule}`;
      const existing = latestCycleCountByKey.get(key);

      const existingTime = parseDate(existing?.timestamp || "")?.getTime() ?? 0;
      const nextTime = parseDate(item.timestamp || "")?.getTime() ?? 0;

      if (!existing || nextTime >= existingTime) {
        latestCycleCountByKey.set(key, item);
      }
    });

    const rows: ReportRow[] = Array.from(map.values())
      .map((row) => {
        const expectedEndingBalance =
          row.beginningBalance +
          row.receipts +
          row.transfersIn -
          row.dispensed -
          row.wasted -
          row.disposed -
          row.transfersOut +
          row.adjustments;

        const cycleCount =
          latestCycleCountByKey.get(row.key);

        return {
          ...row,
          expectedEndingBalance,
          physicalCount:
            drafts[row.key]?.physicalCount ??
            (cycleCount ? String(toNumber(cycleCount.actualQuantity)) : ""),
          reconciledBy:
            drafts[row.key]?.reconciledBy ??
            cycleCount?.countedBy ??
            "",
          reconciledDate:
            drafts[row.key]?.reconciledDate ??
            (cycleCount?.timestamp
              ? new Date(cycleCount.timestamp).toISOString().slice(0, 10)
              : ""),
          notes:
            drafts[row.key]?.notes ??
            cycleCount?.notes ??
            "",
        };
      })
      .sort((a, b) => {
        if (a.location !== b.location) return a.location.localeCompare(b.location);
        if (a.medicationName !== b.medicationName) {
          return a.medicationName.localeCompare(b.medicationName);
        }
        return a.deaSchedule.localeCompare(b.deaSchedule);
      });

    const locations = Array.from(
      new Set(rows.map((row) => row.location).filter(Boolean))
    ).sort();

    return { rows, locations };
  }, [mounted, drafts, startDate, endDate]);

  const rows = useMemo(() => {
    return reportData.rows.filter((row) => {
      const matchesSchedule = selectedSchedules.includes(row.deaSchedule);
      const matchesLocation =
        locationFilter === "ALL" ? true : row.location === locationFilter;

      const haystack = [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.location,
        row.barcode,
        row.ndc,
        row.deaSchedule,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(search.trim().toLowerCase());

      const physicalCount = row.physicalCount === "" ? null : toNumber(row.physicalCount);
      const variance =
        physicalCount === null
          ? null
          : physicalCount - row.expectedEndingBalance;

      const matchesDiscrepancyOnly = discrepancyOnly
        ? variance !== null && variance !== 0
        : true;

      return (
        matchesSchedule &&
        matchesLocation &&
        matchesSearch &&
        matchesDiscrepancyOnly
      );
    });
  }, [reportData.rows, selectedSchedules, locationFilter, search, discrepancyOnly]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        acc.totalExpected += row.expectedEndingBalance;

        const physicalCount = row.physicalCount === "" ? null : toNumber(row.physicalCount);
        if (physicalCount !== null) {
          acc.totalPhysical += physicalCount;
          acc.countedRows += 1;
          const variance = physicalCount - row.expectedEndingBalance;
          if (variance !== 0) acc.varianceRows += 1;
        }

        return acc;
      },
      {
        totalRows: 0,
        totalExpected: 0,
        totalPhysical: 0,
        countedRows: 0,
        varianceRows: 0,
      }
    );
  }, [rows]);

  function downloadCsv() {
    const headers = [
      "Medication",
      "Strength",
      "Dosage Form",
      "Manufacturer",
      "Barcode",
      "NDC",
      "DEA Schedule",
      "Location",
      "Beginning Balance",
      "Receipts",
      "Transfers In",
      "Dispensed",
      "Wasted",
      "Disposed",
      "Transfers Out",
      "Adjustments",
      "Expected Ending Balance",
      "Physical Count",
      "Variance",
      "Reconciled By",
      "Reconciled Date",
      "Notes",
    ];

    const lines = rows.map((row) => {
      const physicalCount = row.physicalCount === "" ? "" : toNumber(row.physicalCount);
      const variance =
        physicalCount === ""
          ? ""
          : Number(physicalCount) - row.expectedEndingBalance;

      return [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.deaSchedule,
        row.location,
        row.beginningBalance,
        row.receipts,
        row.transfersIn,
        row.dispensed,
        row.wasted,
        row.disposed,
        row.transfersOut,
        row.adjustments,
        row.expectedEndingBalance,
        physicalCount,
        variance,
        row.reconciledBy,
        row.reconciledDate,
        row.notes,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",");
    });

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-controlled-reconciliation.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Reports / Controlled Reconciliation
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Controlled Medication Reconciliation
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Reconcile controlled medications by DEA schedule, location, and date
              range using the real transaction logs already saved in MedTrak.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/reports"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Reports
            </Link>
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Rows" value={formatNumber(summary.totalRows)} />
        <SummaryCard
          label="Expected Ending"
          value={formatNumber(summary.totalExpected)}
        />
        <SummaryCard
          label="Physical Counted"
          value={formatNumber(summary.totalPhysical)}
        />
        <SummaryCard
          label="Counted Rows"
          value={formatNumber(summary.countedRows)}
        />
        <SummaryCard
          label="Variance Rows"
          value={formatNumber(summary.varianceRows)}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, barcode, NDC..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">All Locations</option>
              {reportData.locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <label className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={discrepancyOnly}
                onChange={(e) => setDiscrepancyOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Discrepancy only
            </label>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              DEA schedules
            </span>

            <button
              type="button"
              onClick={selectAllSchedules}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
            >
              Select all
            </button>

            <button
              type="button"
              onClick={clearSchedules}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
            >
              Clear all
            </button>

            <div className="flex flex-wrap gap-2">
              {SCHEDULE_OPTIONS.map((schedule) => {
                const active = selectedSchedules.includes(schedule);

                return (
                  <button
                    key={schedule}
                    type="button"
                    onClick={() => toggleSchedule(schedule)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 border border-slate-300"
                    }`}
                  >
                    {schedule}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Medication</th>
                <th className="px-4 py-2">Schedule</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Beginning</th>
                <th className="px-4 py-2">Receipts</th>
                <th className="px-4 py-2">Transfers In</th>
                <th className="px-4 py-2">Dispensed</th>
                <th className="px-4 py-2">Wasted</th>
                <th className="px-4 py-2">Disposed</th>
                <th className="px-4 py-2">Transfers Out</th>
                <th className="px-4 py-2">Adjustments</th>
                <th className="px-4 py-2">Expected</th>
                <th className="px-4 py-2">Physical</th>
                <th className="px-4 py-2">Variance</th>
                <th className="px-4 py-2">Reconciled By</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={17}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No reconciliation rows match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const physicalCount =
                    row.physicalCount === "" ? null : toNumber(row.physicalCount);
                  const variance =
                    physicalCount === null
                      ? null
                      : physicalCount - row.expectedEndingBalance;

                  return (
                    <tr key={row.key} className="align-top text-sm text-slate-700">
                      <td className="rounded-l-2xl bg-slate-50 px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.medicationName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {[row.strength, row.dosageForm, row.manufacturer]
                            .filter(Boolean)
                            .join(" • ") || row.barcode || row.ndc || "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {row.barcode || row.ndc || "-"}
                        </div>
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${scheduleBadgeClass(
                            row.deaSchedule
                          )}`}
                        >
                          {row.deaSchedule}
                        </span>
                      </td>

                      <td className="bg-slate-50 px-4 py-3">{row.location}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.beginningBalance)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.receipts)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.transfersIn)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.dispensed)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.wasted)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.disposed)}</td>
                      <td className="bg-slate-50 px-4 py-3">{formatNumber(row.transfersOut)}</td>
                      <td className="bg-slate-50 px-4 py-3">
                        {row.adjustments > 0
                          ? `+${formatNumber(row.adjustments)}`
                          : formatNumber(row.adjustments)}
                      </td>
                      <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">
                        {formatNumber(row.expectedEndingBalance)}
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={row.physicalCount}
                          onChange={(e) =>
                            updateReconciliation(row.key, "physicalCount", e.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          placeholder="Count"
                        />
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        {variance === null ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${varianceBadgeClass(
                              variance
                            )}`}
                          >
                            {variance > 0 ? `+${variance}` : variance}
                          </span>
                        )}
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <input
                          type="text"
                          value={row.reconciledBy}
                          onChange={(e) =>
                            updateReconciliation(row.key, "reconciledBy", e.target.value)
                          }
                          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          placeholder="Name"
                        />
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <input
                          type="date"
                          value={row.reconciledDate}
                          onChange={(e) =>
                            updateReconciliation(row.key, "reconciledDate", e.target.value)
                          }
                          className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </td>

                      <td className="rounded-r-2xl bg-slate-50 px-4 py-3">
                        <textarea
                          value={row.notes}
                          onChange={(e) =>
                            updateReconciliation(row.key, "notes", e.target.value)
                          }
                          rows={2}
                          className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                          placeholder="Discrepancy comment"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
