"use client";

import { useEffect, useMemo, useState } from "react";

type ActionType = "WASTE" | "DISPOSE";

type SavedWasteRecord = {
  barcode?: string;
  medicationName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location?: string;
  quantity?: string | number;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  wastedBy?: string;
  timestamp?: string;
};

type SavedDisposeRecord = {
  barcode?: string;
  medicationName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  location?: string;
  quantity?: string | number;
  reasonCode?: string;
  notes?: string;
  deaSchedule?: string;
  witnessName?: string;
  disposedBy?: string;
  timestamp?: string;
};

type WasteReportRow = {
  id: string;
  timestamp: string;
  actionType: ActionType;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  barcode: string;
  ndc: string;
  location: string;
  deaSchedule: string;
  quantity: number;
  reasonCode: string;
  performedBy: string;
  witnessName: string;
  notes: string;
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

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function actionBadgeClass(actionType: ActionType) {
  return actionType === "WASTE"
    ? "bg-amber-100 text-amber-700 border border-amber-200"
    : "bg-rose-100 text-rose-700 border border-rose-200";
}

export default function WasteDisposalReportPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<WasteReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [typeFilter, setTypeFilter] = useState("All");
  const [scheduleFilter, setScheduleFilter] = useState("All");
  const [dateRange, setDateRange] = useState("All Time");

  useEffect(() => {
    setMounted(true);

    const waste = safeRead<SavedWasteRecord>("medtrak-waste-log");
    const dispose = safeRead<SavedDisposeRecord>("medtrak-dispose-log");

    const wasteRows: WasteReportRow[] = waste.map((item, index) => ({
      id: `waste-${index}-${item.timestamp || ""}`,
      timestamp: normalizeText(item.timestamp),
      actionType: "WASTE",
      medicationName: normalizeText(item.medicationName, "Unknown Medication"),
      strength: normalizeText(item.strength),
      dosageForm: normalizeText(item.dosageForm),
      manufacturer: normalizeText(item.manufacturer),
      barcode: normalizeText(item.barcode),
      ndc: normalizeText(item.ndc),
      location: normalizeText(item.location, "Unknown Location"),
      deaSchedule: normalizeText(item.deaSchedule),
      quantity: toNumber(item.quantity),
      reasonCode: normalizeText(item.reasonCode),
      performedBy: normalizeText(item.wastedBy, "-"),
      witnessName: normalizeText(item.witnessName),
      notes: normalizeText(item.notes),
    }));

    const disposeRows: WasteReportRow[] = dispose.map((item, index) => ({
      id: `dispose-${index}-${item.timestamp || ""}`,
      timestamp: normalizeText(item.timestamp),
      actionType: "DISPOSE",
      medicationName: normalizeText(item.medicationName, "Unknown Medication"),
      strength: normalizeText(item.strength),
      dosageForm: normalizeText(item.dosageForm),
      manufacturer: normalizeText(item.manufacturer),
      barcode: normalizeText(item.barcode),
      ndc: normalizeText(item.ndc),
      location: normalizeText(item.location, "Unknown Location"),
      deaSchedule: normalizeText(item.deaSchedule),
      quantity: toNumber(item.quantity),
      reasonCode: normalizeText(item.reasonCode),
      performedBy: normalizeText(item.disposedBy, "-"),
      witnessName: normalizeText(item.witnessName),
      notes: normalizeText(item.notes),
    }));

    const merged = [...wasteRows, ...disposeRows].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;

      return bTime - aTime;
    });

    setRows(merged);
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    const dayWindow =
      dateRange === "Last 7 Days"
        ? 7
        : dateRange === "Last 30 Days"
        ? 30
        : dateRange === "Last 90 Days"
        ? 90
        : null;

    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        [
          row.medicationName,
          row.strength,
          row.dosageForm,
          row.manufacturer,
          row.barcode,
          row.ndc,
          row.location,
          row.reasonCode,
          row.performedBy,
          row.witnessName,
          row.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesLocation =
        locationFilter === "All Locations" || row.location === locationFilter;

      const matchesType = typeFilter === "All" || row.actionType === typeFilter;

      const matchesSchedule =
        scheduleFilter === "All" || row.deaSchedule === scheduleFilter;

      const rowTime = new Date(row.timestamp).getTime();
      const matchesDate =
        dayWindow === null ||
        (Number.isFinite(rowTime) &&
          now - rowTime <= dayWindow * 24 * 60 * 60 * 1000);

      return (
        matchesSearch &&
        matchesLocation &&
        matchesType &&
        matchesSchedule &&
        matchesDate
      );
    });
  }, [rows, search, locationFilter, typeFilter, scheduleFilter, dateRange]);

  const locations = useMemo(() => {
    return [
      "All Locations",
      ...Array.from(new Set(rows.map((row) => row.location).filter(Boolean))),
    ];
  }, [rows]);

  const schedules = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(rows.map((row) => row.deaSchedule).filter(Boolean))),
    ];
  }, [rows]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalEvents += 1;
        acc.totalQuantity += row.quantity;
        if (row.actionType === "WASTE") {
          acc.wasteEvents += 1;
          acc.wasteQuantity += row.quantity;
        }
        if (row.actionType === "DISPOSE") {
          acc.disposeEvents += 1;
          acc.disposeQuantity += row.quantity;
        }
        if (row.witnessName) acc.witnessedEvents += 1;
        return acc;
      },
      {
        totalEvents: 0,
        totalQuantity: 0,
        wasteEvents: 0,
        disposeEvents: 0,
        wasteQuantity: 0,
        disposeQuantity: 0,
        witnessedEvents: 0,
      }
    );
  }, [filteredRows]);

  function exportCsv() {
    const header = [
      "Date",
      "Type",
      "Medication",
      "Strength",
      "Dosage Form",
      "Manufacturer",
      "Barcode",
      "NDC",
      "Location",
      "DEA Schedule",
      "Quantity",
      "Reason",
      "Performed By",
      "Witness",
      "Notes",
    ];

    const lines = filteredRows.map((row) =>
      [
        formatDateTime(row.timestamp),
        row.actionType,
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.location,
        row.deaSchedule,
        row.quantity,
        row.reasonCode,
        row.performedBy,
        row.witnessName,
        row.notes,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-waste-disposal-report.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const rowsHtml = filteredRows
      .map(
        (row) => `
          <tr>
            <td>${formatDateTime(row.timestamp)}</td>
            <td>${row.actionType}</td>
            <td>${row.medicationName}</td>
            <td>${row.location || "-"}</td>
            <td>${row.deaSchedule || "-"}</td>
            <td>${row.quantity}</td>
            <td>${row.reasonCode || "-"}</td>
            <td>${row.performedBy || "-"}</td>
            <td>${row.witnessName || "-"}</td>
            <td>${row.notes || "-"}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Waste & Disposal Report</title>
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
              margin: 0 0 10px 0;
              color: #475569;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin: 24px 0;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 16px;
              padding: 16px;
            }
            .label {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 8px;
            }
            .value {
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
          <h1>Waste & Disposal Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Review wasted and disposed medications, including reason, witness, location, and user details.</p>

          <div class="summary">
            <div class="card">
              <div class="label">Total Events</div>
              <div class="value">${summary.totalEvents}</div>
            </div>
            <div class="card">
              <div class="label">Waste Quantity</div>
              <div class="value">${summary.wasteQuantity}</div>
            </div>
            <div class="card">
              <div class="label">Dispose Quantity</div>
              <div class="value">${summary.disposeQuantity}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Medication</th>
                <th>Location</th>
                <th>DEA</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Performed By</th>
                <th>Witness</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="10">No rows found.</td></tr>`}
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
          Waste & Disposal
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
              Waste & Disposal
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review wasted and disposed medications with witness, reason, location, and user details.
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total Events" value={summary.totalEvents} />
        <SummaryCard label="Total Quantity" value={summary.totalQuantity} />
        <SummaryCard label="Waste Events" value={summary.wasteEvents} />
        <SummaryCard label="Dispose Events" value={summary.disposeEvents} />
        <SummaryCard label="Waste Quantity" value={summary.wasteQuantity} />
        <SummaryCard label="Witnessed Events" value={summary.witnessedEvents} />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, barcode, reason, witness..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

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
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {["All", "WASTE", "DISPOSE"].map((type) => (
                <option key={type} value={type}>
                  {type}
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
              {schedules.map((schedule) => (
                <option key={schedule} value={schedule}>
                  {schedule}
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
              {["All Time", "Last 7 Days", "Last 30 Days", "Last 90 Days"].map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Medication</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">DEA</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Performed By</th>
                <th className="px-4 py-3">Witness</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                    No waste or disposal records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t align-top text-sm text-slate-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(row.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${actionBadgeClass(
                          row.actionType
                        )}`}
                      >
                        {row.actionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.medicationName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[row.strength, row.dosageForm, row.manufacturer]
                          .filter(Boolean)
                          .join(" • ") || row.barcode || row.ndc || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.location || "-"}</td>
                    <td className="px-4 py-3">{row.deaSchedule || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.quantity}
                    </td>
                    <td className="px-4 py-3">{row.reasonCode || "-"}</td>
                    <td className="px-4 py-3">{row.performedBy || "-"}</td>
                    <td className="px-4 py-3">{row.witnessName || "-"}</td>
                    <td className="px-4 py-3">{row.notes || "-"}</td>
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
