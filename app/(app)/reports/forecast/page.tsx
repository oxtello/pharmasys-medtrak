"use client";

import { useEffect, useMemo, useState } from "react";

type ReportRow = {
  id: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  barcode: string;
  ndc: string;
  location: string;
  deaSchedule: string;
  onHandQuantity: number;
  dispensed30: number;
  dispensed60: number;
  dispensed90: number;
  avgDailyUsage30: number;
  daysOfSupply: number | null;
  parLevel: number;
  reorderPoint: number;
  criticalPoint: number;
  suggestedReorderQty: number;
  status: "Healthy" | "Low" | "Critical";
};

type Summary = {
  totalRows: number;
  totalOnHand: number;
  totalDispensed30: number;
  totalSuggestedReorder: number;
  criticalCount: number;
  lowCount: number;
};

function safeParse<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function normalizeDate(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getStatus(
  onHand: number,
  reorderPoint: number,
  criticalPoint: number
): "Healthy" | "Low" | "Critical" {
  if (onHand <= criticalPoint) return "Critical";
  if (onHand <= reorderPoint) return "Low";
  return "Healthy";
}

function getStatusBadgeClasses(status: ReportRow["status"]) {
  if (status === "Critical") {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (status === "Low") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 border border-emerald-200";
}

function getDefaultParLevel(receivedQuantity: number) {
  if (receivedQuantity >= 100) return 100;
  if (receivedQuantity >= 50) return 50;
  if (receivedQuantity >= 20) return 20;
  return 10;
}

function getDefaultReorderPoint(parLevel: number) {
  return Math.max(1, Math.ceil(parLevel * 0.4));
}

function getDefaultCriticalPoint(reorderPoint: number) {
  return Math.max(0, Math.ceil(reorderPoint * 0.5));
}

export default function ForecastReportPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [scheduleFilter, setScheduleFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);

    const receives = safeParse<any[]>(
      localStorage.getItem("medtrak-received-stock"),
      []
    );
    const dispenses = safeParse<any[]>(
      localStorage.getItem("medtrak-dispense-log"),
      []
    );
    const adjustments = safeParse<any[]>(
      localStorage.getItem("medtrak-adjust-log"),
      []
    );
    const transfers = safeParse<any[]>(
      localStorage.getItem("medtrak-transfer-log"),
      []
    );
    const waste = safeParse<any[]>(
      localStorage.getItem("medtrak-waste-log"),
      []
    );
    const disposals = safeParse<any[]>(
      localStorage.getItem("medtrak-dispose-log"),
      []
    );

    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    const map = new Map<string, ReportRow>();

    function getKey(record: any) {
      const barcode = normalizeText(record.barcode || record.ndc || record.medicationId || "unknown-barcode");
      const location = normalizeText(record.location || "Unknown Location");
      return `${barcode}__${location}`;
    }

    function ensureRow(record: any) {
      const key = getKey(record);

      if (!map.has(key)) {
        const medicationName = normalizeText(
          record.medicationName || record.name || "Unknown Medication"
        );
        const strength = normalizeText(record.strength);
        const dosageForm = normalizeText(record.dosageForm);
        const manufacturer = normalizeText(record.manufacturer);
        const barcode = normalizeText(record.barcode);
        const ndc = normalizeText(record.ndc);
        const location = normalizeText(record.location || "Unknown Location");
        const deaSchedule = normalizeText(record.deaSchedule || "-");

        const receivedQty = toNumber(
          record.quantityReceived ?? record.quantity ?? record.qty ?? 0
        );
        const parLevel =
          toNumber(record.parLevel) || getDefaultParLevel(receivedQty);
        const reorderPoint =
          toNumber(record.reorderPoint) || getDefaultReorderPoint(parLevel);
        const criticalPoint =
          toNumber(record.criticalPoint) || getDefaultCriticalPoint(reorderPoint);

        map.set(key, {
          id: key,
          medicationName,
          strength,
          dosageForm,
          manufacturer,
          barcode,
          ndc,
          location,
          deaSchedule,
          onHandQuantity: 0,
          dispensed30: 0,
          dispensed60: 0,
          dispensed90: 0,
          avgDailyUsage30: 0,
          daysOfSupply: null,
          parLevel,
          reorderPoint,
          criticalPoint,
          suggestedReorderQty: 0,
          status: "Healthy",
        });
      }

      return map.get(key)!;
    }

    for (const record of receives) {
      const row = ensureRow(record);
      row.onHandQuantity += toNumber(
        record.quantityReceived ?? record.quantity ?? record.qty ?? 0
      );

      if (!row.deaSchedule || row.deaSchedule === "-") {
        row.deaSchedule = normalizeText(record.deaSchedule || "-");
      }
    }

    for (const record of dispenses) {
      const row = ensureRow(record);
      const qty = toNumber(record.quantityDispensed ?? record.quantity ?? record.qty ?? 0);
      row.onHandQuantity -= qty;

      const ts = normalizeDate(
        record.timestamp || record.createdAt || record.date || record.administeredAt
      );

      if (ts !== null) {
        if (now - ts <= THIRTY_DAYS) row.dispensed30 += qty;
        if (now - ts <= SIXTY_DAYS) row.dispensed60 += qty;
        if (now - ts <= NINETY_DAYS) row.dispensed90 += qty;
      }
    }

    for (const record of adjustments) {
      const row = ensureRow(record);

      if (typeof record.quantityChange !== "undefined") {
        row.onHandQuantity += toNumber(record.quantityChange);
      } else {
        const adjustmentType = normalizeText(record.adjustmentType).toLowerCase();
        const qty = toNumber(record.quantityAdjusted ?? record.quantity ?? record.qty ?? 0);
        row.onHandQuantity += adjustmentType === "decrease" ? -qty : qty;
      }
    }

    for (const record of transfers) {
      const qty = toNumber(
        record.quantityTransferred ?? record.quantity ?? record.qty ?? 0
      );

      const fromLocation = normalizeText(record.fromLocation);
      const toLocation = normalizeText(record.toLocation);
      const barcode = normalizeText(record.barcode);

      if (fromLocation) {
        const fromRow = ensureRow({
          ...record,
          location: fromLocation,
          barcode,
        });
        fromRow.onHandQuantity -= qty;
      }

      if (toLocation) {
        const toRow = ensureRow({
          ...record,
          location: toLocation,
          barcode,
        });
        toRow.onHandQuantity += qty;
      }
    }

    for (const record of waste) {
      const row = ensureRow(record);
      row.onHandQuantity -= toNumber(
        record.quantityWasted ?? record.quantity ?? record.qty ?? 0
      );
    }

    for (const record of disposals) {
      const row = ensureRow(record);
      row.onHandQuantity -= toNumber(
        record.quantityDisposed ?? record.quantity ?? record.qty ?? 0
      );
    }

    const finalRows = Array.from(map.values())
      .map((row) => {
        row.onHandQuantity = Math.max(0, row.onHandQuantity);
        row.avgDailyUsage30 = row.dispensed30 / 30;
        row.daysOfSupply =
          row.avgDailyUsage30 > 0
            ? row.onHandQuantity / row.avgDailyUsage30
            : null;
        row.suggestedReorderQty = Math.max(0, row.parLevel - row.onHandQuantity);
        row.status = getStatus(
          row.onHandQuantity,
          row.reorderPoint,
          row.criticalPoint
        );
        return row;
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          const order = { Critical: 0, Low: 1, Healthy: 2 };
          return order[a.status] - order[b.status];
        }
        return a.medicationName.localeCompare(b.medicationName);
      });

    setRows(finalRows);
  }, []);

  const locations = useMemo(() => {
    return ["All Locations", ...new Set(rows.map((row) => row.location).filter(Boolean))];
  }, [rows]);

  const schedules = useMemo(() => {
    return ["All", ...new Set(rows.map((row) => row.deaSchedule).filter(Boolean))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesLocation =
        locationFilter === "All Locations" || row.location === locationFilter;

      const matchesSchedule =
        scheduleFilter === "All" || row.deaSchedule === scheduleFilter;

      const haystack = [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.location,
        row.deaSchedule,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || haystack.includes(term);

      return matchesLocation && matchesSchedule && matchesSearch;
    });
  }, [rows, locationFilter, scheduleFilter, search]);

  const summary = useMemo<Summary>(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        acc.totalOnHand += row.onHandQuantity;
        acc.totalDispensed30 += row.dispensed30;
        acc.totalSuggestedReorder += row.suggestedReorderQty;
        if (row.status === "Critical") acc.criticalCount += 1;
        if (row.status === "Low") acc.lowCount += 1;
        return acc;
      },
      {
        totalRows: 0,
        totalOnHand: 0,
        totalDispensed30: 0,
        totalSuggestedReorder: 0,
        criticalCount: 0,
        lowCount: 0,
      }
    );
  }, [filteredRows]);

  function downloadCsv() {
    const header = [
      "Medication",
      "Strength",
      "Dosage Form",
      "Manufacturer",
      "Barcode",
      "NDC",
      "Location",
      "DEA Schedule",
      "On Hand",
      "Dispensed 30 Days",
      "Dispensed 60 Days",
      "Dispensed 90 Days",
      "Avg Daily Usage (30d)",
      "Days of Supply",
      "Par Level",
      "Reorder Point",
      "Critical Point",
      "Suggested Reorder Qty",
      "Status",
    ];

    const lines = filteredRows.map((row) =>
      [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.location,
        row.deaSchedule,
        row.onHandQuantity,
        row.dispensed30,
        row.dispensed60,
        row.dispensed90,
        row.avgDailyUsage30.toFixed(2),
        row.daysOfSupply === null ? "" : row.daysOfSupply.toFixed(1),
        row.parLevel,
        row.reorderPoint,
        row.criticalPoint,
        row.suggestedReorderQty,
        row.status,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-forecast-reorder-report.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Forecast & Reorder
          </h1>
          <p className="mt-2 text-sm text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Forecast & Reorder
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Estimate medication demand, monitor days of supply, and identify
              replenishment needs by location.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadCsv}
              className="rounded-xl bg-[color:var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Rows</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalRows}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">On Hand</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalOnHand}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">30d Dispensed</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalDispensed30}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Suggested Reorder</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalSuggestedReorder}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Critical</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">
            {summary.criticalCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Low</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {summary.lowCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, barcode, NDC, manufacturer..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
            >
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              DEA Schedule
            </label>
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
            >
              {schedules.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {schedule}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setLocationFilter("All Locations");
                setScheduleFilter("All");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Medication</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">DEA</th>
                <th className="px-4 py-3">On Hand</th>
                <th className="px-4 py-3">30d</th>
                <th className="px-4 py-3">60d</th>
                <th className="px-4 py-3">90d</th>
                <th className="px-4 py-3">Avg/Day</th>
                <th className="px-4 py-3">Days Supply</th>
                <th className="px-4 py-3">Par</th>
                <th className="px-4 py-3">Reorder</th>
                <th className="px-4 py-3">Critical</th>
                <th className="px-4 py-3">Suggested</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No forecast rows found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t align-top text-sm text-slate-700"
                  >
                    <td className="px-4 py-3">
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

                    <td className="px-4 py-3">{row.location || "-"}</td>
                    <td className="px-4 py-3">{row.deaSchedule || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.onHandQuantity}
                    </td>
                    <td className="px-4 py-3">{row.dispensed30}</td>
                    <td className="px-4 py-3">{row.dispensed60}</td>
                    <td className="px-4 py-3">{row.dispensed90}</td>
                    <td className="px-4 py-3">
                      {row.avgDailyUsage30.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {row.daysOfSupply === null
                        ? "-"
                        : row.daysOfSupply.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">{row.parLevel}</td>
                    <td className="px-4 py-3">{row.reorderPoint}</td>
                    <td className="px-4 py-3">{row.criticalPoint}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.suggestedReorderQty}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClasses(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
