"use client";

import { useEffect, useMemo, useState } from "react";

type SavedCycleCountRecord = {
  barcode?: string;
  medicationName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location?: string;
  expectedQuantity?: string | number;
  actualQuantity?: string | number;
  countedQuantity?: string | number;
  variance?: string | number;
  notes?: string;
  deaSchedule?: string;
  countedBy?: string;
  timestamp?: string;
};

type VarianceRow = {
  id: string;
  barcode: string;
  medicationName: string;
  location: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  deaSchedule: string;
  countedBy: string;
  timestamp: string;
  notes: string;
};

type Summary = {
  varianceEvents: number;
  controlledVarianceEvents: number;
  largestVariance: number;
  medicationsWithVariance: number;
};

function safeRead<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeText(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function normalizeSchedule(value?: string) {
  const normalized = String(value || "").trim().toUpperCase();
  return ["C2", "C3", "C4", "C5"].includes(normalized) ? normalized : "";
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getVarianceBadgeClasses(variance: number) {
  if (variance < 0) {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  if (variance > 0) {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }
  return "bg-emerald-100 text-emerald-700 border border-emerald-200";
}

export default function DiversionControlReportPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [locationFilter, setLocationFilter] = useState("All");
  const [scheduleFilter, setScheduleFilter] = useState("All");
  const [medicationFilter, setMedicationFilter] = useState("All");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(true);

  useEffect(() => {
    setMounted(true);

    const cycleCounts = safeRead<SavedCycleCountRecord>("medtrak-cycle-count-log");

    const mapped: VarianceRow[] = cycleCounts.map((record, index) => {
      const expectedQuantity = toNumber(record.expectedQuantity);
      const actualQuantity = toNumber(
        typeof record.actualQuantity !== "undefined"
          ? record.actualQuantity
          : record.countedQuantity
      );

      const rawVariance =
        typeof record.variance !== "undefined"
          ? toNumber(record.variance)
          : actualQuantity - expectedQuantity;

      return {
        id: `${record.barcode || "unknown"}-${record.location || "unknown"}-${record.timestamp || index}-${index}`,
        barcode: normalizeText(record.barcode),
        medicationName: normalizeText(record.medicationName, "Unknown Medication"),
        location: normalizeText(record.location, "Unknown Location"),
        expectedQuantity,
        actualQuantity,
        variance: rawVariance,
        deaSchedule: normalizeSchedule(record.deaSchedule),
        countedBy: normalizeText(record.countedBy, "-"),
        timestamp: normalizeText(record.timestamp),
        notes: normalizeText(record.notes),
      };
    });

    mapped.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });

    setRows(mapped);
  }, []);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const daysMap: Record<string, number> = {
      "Last 7 Days": 7,
      "Last 30 Days": 30,
      "Last 90 Days": 90,
      "All Time": 99999,
    };

    const dayLimit = daysMap[dateRange] ?? 30;

    return rows.filter((row) => {
      const matchesLocation =
        locationFilter === "All" || row.location === locationFilter;

      const matchesSchedule =
        scheduleFilter === "All" || row.deaSchedule === scheduleFilter;

      const matchesMedication =
        medicationFilter === "All" || row.medicationName === medicationFilter;

      const rowTime = new Date(row.timestamp).getTime();
      const matchesDate =
        dateRange === "All Time" ||
        (Number.isFinite(rowTime) &&
          now - rowTime <= dayLimit * 24 * 60 * 60 * 1000);

      const matchesDiscrepancy = discrepancyOnly ? row.variance !== 0 : true;

      return (
        matchesLocation &&
        matchesSchedule &&
        matchesMedication &&
        matchesDate &&
        matchesDiscrepancy
      );
    });
  }, [rows, locationFilter, scheduleFilter, medicationFilter, dateRange, discrepancyOnly]);

  const summary = useMemo<Summary>(() => {
    const medicationsWithVariance = new Set(
      filteredRows.filter((row) => row.variance !== 0).map((row) => row.medicationName)
    );

    return {
      varianceEvents: filteredRows.filter((row) => row.variance !== 0).length,
      controlledVarianceEvents: filteredRows.filter(
        (row) => row.variance !== 0 && ["C2", "C3", "C4", "C5"].includes(row.deaSchedule)
      ).length,
      largestVariance: filteredRows.reduce((largest, row) => {
        return Math.max(largest, Math.abs(row.variance));
      }, 0),
      medicationsWithVariance: medicationsWithVariance.size,
    };
  }, [filteredRows]);

  const repeatedVarianceMeds = useMemo(() => {
    const counts = new Map<
      string,
      {
        medicationName: string;
        events: number;
        lastCount: string;
      }
    >();

    for (const row of filteredRows) {
      if (row.variance === 0) continue;

      const existing = counts.get(row.medicationName);
      if (!existing) {
        counts.set(row.medicationName, {
          medicationName: row.medicationName,
          events: 1,
          lastCount: row.timestamp,
        });
      } else {
        existing.events += 1;
        const existingTime = new Date(existing.lastCount).getTime();
        const rowTime = new Date(row.timestamp).getTime();
        if (rowTime > existingTime) {
          existing.lastCount = row.timestamp;
        }
      }
    }

    return Array.from(counts.values())
      .filter((item) => item.events > 1)
      .sort((a, b) => b.events - a.events || a.medicationName.localeCompare(b.medicationName));
  }, [filteredRows]);

  const largestDiscrepancies = useMemo(() => {
    return [...filteredRows]
      .filter((row) => row.variance !== 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 5);
  }, [filteredRows]);

  const locations = useMemo(() => {
    return ["All", ...new Set(rows.map((row) => row.location).filter(Boolean))];
  }, [rows]);

  const medications = useMemo(() => {
    return ["All", ...new Set(rows.map((row) => row.medicationName).filter(Boolean))];
  }, [rows]);

  function exportCsv() {
    const header = [
      "Medication",
      "Location",
      "Expected",
      "Actual",
      "Variance",
      "DEA Schedule",
      "Counted By",
      "Date",
      "Notes",
    ];

    const lines = filteredRows.map((row) =>
      [
        row.medicationName,
        row.location,
        row.expectedQuantity,
        row.actualQuantity,
        row.variance,
        row.deaSchedule || "",
        row.countedBy,
        formatDateTime(row.timestamp),
        row.notes || "",
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-diversion-control-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const reportDate = new Date().toLocaleString();

    const rowsHtml = filteredRows
      .map(
        (row) => `
        <tr>
          <td>${row.medicationName}</td>
          <td>${row.location}</td>
          <td>${row.expectedQuantity}</td>
          <td>${row.actualQuantity}</td>
          <td>${formatSigned(row.variance)}</td>
          <td>${row.deaSchedule || "-"}</td>
          <td>${row.countedBy}</td>
          <td>${formatDateTime(row.timestamp)}</td>
          <td>${row.notes || "-"}</td>
        </tr>
      `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Diversion Control Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #0f172a;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 28px;
            }
            p {
              margin: 0 0 12px 0;
              color: #475569;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin: 24px 0;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 16px;
              padding: 16px;
            }
            .card-label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 8px;
            }
            .card-value {
              font-size: 28px;
              font-weight: 700;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f8fafc;
            }
          </style>
        </head>
        <body>
          <h1>Diversion Control Report</h1>
          <p>Generated: ${reportDate}</p>
          <p>Cycle count variances, repeated discrepancies, and controlled-medication variance activity.</p>

          <div class="summary">
            <div class="card">
              <div class="card-label">Variance Events</div>
              <div class="card-value">${summary.varianceEvents}</div>
            </div>
            <div class="card">
              <div class="card-label">Controlled Med Variances</div>
              <div class="card-value">${summary.controlledVarianceEvents}</div>
            </div>
            <div class="card">
              <div class="card-label">Largest Variance</div>
              <div class="card-value">${summary.largestVariance}</div>
            </div>
            <div class="card">
              <div class="card-label">Medications With Variance</div>
              <div class="card-value">${summary.medicationsWithVariance}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Location</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>DEA Schedule</th>
                <th>Counted By</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="9">No rows found.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  if (!mounted) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Diversion Control Report
        </h1>
        <p className="mt-2 text-sm text-slate-600">Loading report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Diversion Control Report
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review cycle count variances, repeated discrepancies, and controlled-medication variance activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              className="rounded-xl bg-[color:var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Export CSV
            </button>
            <button
              onClick={exportPdf}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Variance Events</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.varianceEvents}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Controlled Med Variances</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.controlledVarianceEvents}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Largest Variance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.largestVariance}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Medications With Variance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.medicationsWithVariance}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {["All", "C2", "C3", "C4", "C5"].map((schedule) => (
                <option key={schedule} value={schedule}>
                  {schedule}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Medication
            </label>
            <select
              value={medicationFilter}
              onChange={(e) => setMedicationFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {medications.map((medication) => (
                <option key={medication} value={medication}>
                  {medication}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {["Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time"].map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <span>Discrepancy Only</span>
              <input
                type="checkbox"
                checked={discrepancyOnly}
                onChange={(e) => setDiscrepancyOnly(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
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
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Actual</th>
                <th className="px-4 py-3">Variance</th>
                <th className="px-4 py-3">DEA</th>
                <th className="px-4 py-3">Counted By</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    No variance rows found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t align-top text-sm text-slate-700">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.medicationName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.barcode || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.location}</td>
                    <td className="px-4 py-3">{row.expectedQuantity}</td>
                    <td className="px-4 py-3">{row.actualQuantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getVarianceBadgeClasses(
                          row.variance
                        )}`}
                      >
                        {formatSigned(row.variance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.deaSchedule || "-"}</td>
                    <td className="px-4 py-3">{row.countedBy}</td>
                    <td className="px-4 py-3">{formatDateTime(row.timestamp)}</td>
                    <td className="px-4 py-3">{row.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Medications With Repeated Variance
          </h2>

          {repeatedVarianceMeds.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No repeated variance patterns found.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {repeatedVarianceMeds.map((item) => (
                <div
                  key={item.medicationName}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="font-medium text-slate-900">{item.medicationName}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Variance Events: {item.events}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Last Count: {formatDateTime(item.lastCount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Largest Discrepancies
          </h2>

          {largestDiscrepancies.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No discrepancies found.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {largestDiscrepancies.map((row) => (
                <div
                  key={`largest-${row.id}`}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <div className="font-medium text-slate-900">{row.medicationName}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {row.location} {row.deaSchedule ? `• ${row.deaSchedule}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Expected {row.expectedQuantity} • Actual {row.actualQuantity}
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getVarianceBadgeClasses(
                      row.variance
                    )}`}
                  >
                    {formatSigned(row.variance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
