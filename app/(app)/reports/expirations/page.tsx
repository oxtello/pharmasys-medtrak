"use client";

import { useEffect, useMemo, useState } from "react";

type ExpirationRow = {
  id: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  barcode: string;
  ndc: string;
  lotNumber: string;
  expirationDate: string;
  location: string;
  deaSchedule: string;
  onHandQuantity: number;
  daysUntilExpiration: number | null;
  status: "Expired" | "Critical" | "Warning" | "Healthy" | "Unknown";
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

function normalizeText(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const parts = value.split("/");
  if (parts.length === 3) {
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    const year = Number(parts[2]);
    const alt = new Date(year, month - 1, day);
    if (!Number.isNaN(alt.getTime())) return alt;
  }

  return null;
}

function formatDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value || "-";
  return parsed.toLocaleDateString();
}

function calculateDaysUntilExpiration(expirationDate: string): number | null {
  const parsed = parseDate(expirationDate);
  if (!parsed) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const startOfExpiry = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );

  const diffMs = startOfExpiry.getTime() - startOfToday.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getExpirationStatus(
  daysUntilExpiration: number | null
): ExpirationRow["status"] {
  if (daysUntilExpiration === null) return "Unknown";
  if (daysUntilExpiration < 0) return "Expired";
  if (daysUntilExpiration <= 30) return "Critical";
  if (daysUntilExpiration <= 90) return "Warning";
  return "Healthy";
}

function statusClasses(status: ExpirationRow["status"]) {
  switch (status) {
    case "Expired":
      return "bg-red-100 text-red-700 border border-red-200";
    case "Critical":
      return "bg-orange-100 text-orange-700 border border-orange-200";
    case "Warning":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "Healthy":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

export default function ExpirationsReportPage() {
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<ExpirationRow[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [statusFilter, setStatusFilter] = useState("All");
  const [scheduleFilter, setScheduleFilter] = useState("All");

  useEffect(() => {
    setMounted(true);

    const receives = safeRead<any>("medtrak-received-stock");
    const dispenses = safeRead<any>("medtrak-dispense-log");
    const adjustments = safeRead<any>("medtrak-adjust-log");
    const transfers = safeRead<any>("medtrak-transfer-log");
    const waste = safeRead<any>("medtrak-waste-log");
    const disposals = safeRead<any>("medtrak-dispose-log");

    const lotMap = new Map<string, ExpirationRow>();

    function makeKey(record: any, locationOverride?: string) {
      const barcode = normalizeText(record.barcode || record.ndc || "unknown");
      const lotNumber = normalizeText(record.lotNumber || "NO-LOT");
      const location = normalizeText(
        locationOverride || record.location || "Unknown Location"
      );
      const expirationDate = normalizeText(record.expirationDate || "");
      return `${barcode}__${lotNumber}__${location}__${expirationDate}`;
    }

    function ensureRow(record: any, locationOverride?: string) {
      const key = makeKey(record, locationOverride);

      if (!lotMap.has(key)) {
        const expirationDate = normalizeText(record.expirationDate || "");
        const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);

        lotMap.set(key, {
          id: key,
          medicationName: normalizeText(
            record.medicationName || record.name,
            "Unknown Medication"
          ),
          strength: normalizeText(record.strength),
          dosageForm: normalizeText(record.dosageForm),
          manufacturer: normalizeText(record.manufacturer),
          barcode: normalizeText(record.barcode),
          ndc: normalizeText(record.ndc),
          lotNumber: normalizeText(record.lotNumber || "-"),
          expirationDate,
          location: normalizeText(
            locationOverride || record.location,
            "Unknown Location"
          ),
          deaSchedule: normalizeText(record.deaSchedule),
          onHandQuantity: 0,
          daysUntilExpiration,
          status: getExpirationStatus(daysUntilExpiration),
        });
      }

      return lotMap.get(key)!;
    }

    for (const record of receives) {
      const row = ensureRow(record);
      row.onHandQuantity += toNumber(
        record.quantityReceived ?? record.quantity ?? record.qty
      );
    }

    for (const record of dispenses) {
      const row = ensureRow(record);
      row.onHandQuantity -= toNumber(
        record.quantityDispensed ?? record.quantity ?? record.qty
      );
    }

    for (const record of adjustments) {
      const row = ensureRow(record);

      if (typeof record.quantityChange !== "undefined") {
        row.onHandQuantity += toNumber(record.quantityChange);
      } else {
        const adjustmentType = normalizeText(record.adjustmentType).toLowerCase();
        const qty = toNumber(
          record.quantityAdjusted ?? record.quantity ?? record.qty
        );
        row.onHandQuantity += adjustmentType === "decrease" ? -qty : qty;
      }
    }

    for (const record of transfers) {
      const qty = toNumber(
        record.quantityTransferred ?? record.quantity ?? record.qty
      );

      const fromLocation = normalizeText(record.fromLocation);
      const toLocation = normalizeText(record.toLocation);

      if (fromLocation) {
        const fromRow = ensureRow(record, fromLocation);
        fromRow.onHandQuantity -= qty;
      }

      if (toLocation) {
        const toRow = ensureRow(record, toLocation);
        toRow.onHandQuantity += qty;
      }
    }

    for (const record of waste) {
      const row = ensureRow(record);
      row.onHandQuantity -= toNumber(
        record.quantityWasted ?? record.quantity ?? record.qty
      );
    }

    for (const record of disposals) {
      const row = ensureRow(record);
      row.onHandQuantity -= toNumber(
        record.quantityDisposed ?? record.quantity ?? record.qty
      );
    }

    const finalRows = Array.from(lotMap.values())
      .map((row) => {
        row.onHandQuantity = Math.max(0, row.onHandQuantity);
        row.daysUntilExpiration = calculateDaysUntilExpiration(row.expirationDate);
        row.status = getExpirationStatus(row.daysUntilExpiration);
        return row;
      })
      .filter((row) => row.onHandQuantity > 0)
      .sort((a, b) => {
        const order = {
          Expired: 0,
          Critical: 1,
          Warning: 2,
          Healthy: 3,
          Unknown: 4,
        };

        if (a.status !== b.status) {
          return order[a.status] - order[b.status];
        }

        const aDays = a.daysUntilExpiration ?? 999999;
        const bDays = b.daysUntilExpiration ?? 999999;
        return aDays - bDays;
      });

    setRows(finalRows);
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

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
          row.lotNumber,
          row.location,
          row.deaSchedule,
          row.expirationDate,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesLocation =
        locationFilter === "All Locations" || row.location === locationFilter;

      const matchesStatus = statusFilter === "All" || row.status === statusFilter;

      const matchesSchedule =
        scheduleFilter === "All" || row.deaSchedule === scheduleFilter;

      return (
        matchesSearch &&
        matchesLocation &&
        matchesStatus &&
        matchesSchedule
      );
    });
  }, [rows, search, locationFilter, statusFilter, scheduleFilter]);

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
        acc.totalLots += 1;
        acc.totalQuantity += row.onHandQuantity;
        if (row.status === "Expired") {
          acc.expiredLots += 1;
          acc.expiredQuantity += row.onHandQuantity;
        }
        if (row.status === "Critical") {
          acc.criticalLots += 1;
          acc.criticalQuantity += row.onHandQuantity;
        }
        if (row.status === "Warning") {
          acc.warningLots += 1;
          acc.warningQuantity += row.onHandQuantity;
        }
        return acc;
      },
      {
        totalLots: 0,
        totalQuantity: 0,
        expiredLots: 0,
        expiredQuantity: 0,
        criticalLots: 0,
        criticalQuantity: 0,
        warningLots: 0,
        warningQuantity: 0,
      }
    );
  }, [filteredRows]);

  function exportCsv() {
    const header = [
      "Medication",
      "Strength",
      "Dosage Form",
      "Manufacturer",
      "Barcode",
      "NDC",
      "Lot Number",
      "Expiration Date",
      "Days Until Expiration",
      "Status",
      "Location",
      "DEA Schedule",
      "On Hand Quantity",
    ];

    const lines = filteredRows.map((row) =>
      [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.lotNumber,
        formatDate(row.expirationDate),
        row.daysUntilExpiration === null ? "" : row.daysUntilExpiration,
        row.status,
        row.location,
        row.deaSchedule,
        row.onHandQuantity,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-expirations-report.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;

    const rowsHtml = filteredRows
      .map(
        (row) => `
          <tr>
            <td>${row.medicationName}</td>
            <td>${row.lotNumber || "-"}</td>
            <td>${formatDate(row.expirationDate)}</td>
            <td>${row.daysUntilExpiration === null ? "-" : row.daysUntilExpiration}</td>
            <td>${row.status}</td>
            <td>${row.location || "-"}</td>
            <td>${row.deaSchedule || "-"}</td>
            <td>${row.onHandQuantity}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Expirations Report</title>
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
              grid-template-columns: repeat(4, 1fr);
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
          <h1>Expirations Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Review expired lots and near-expiration inventory by medication and location.</p>

          <div class="summary">
            <div class="card">
              <div class="label">Total Lots</div>
              <div class="value">${summary.totalLots}</div>
            </div>
            <div class="card">
              <div class="label">Expired Lots</div>
              <div class="value">${summary.expiredLots}</div>
            </div>
            <div class="card">
              <div class="label">Critical Lots</div>
              <div class="value">${summary.criticalLots}</div>
            </div>
            <div class="card">
              <div class="label">Warning Lots</div>
              <div class="value">${summary.warningLots}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Lot Number</th>
                <th>Expiration</th>
                <th>Days Left</th>
                <th>Status</th>
                <th>Location</th>
                <th>DEA</th>
                <th>On Hand</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="8">No rows found.</td></tr>`}
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
          Expirations
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
              Expirations
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review expired and near-expiration inventory by lot and location.
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
        <SummaryCard label="Total Lots" value={summary.totalLots} />
        <SummaryCard label="Total Quantity" value={summary.totalQuantity} />
        <SummaryCard label="Expired Lots" value={summary.expiredLots} />
        <SummaryCard label="Critical Lots" value={summary.criticalLots} />
        <SummaryCard label="Warning Lots" value={summary.warningLots} />
        <SummaryCard label="Expired Qty" value={summary.expiredQuantity} />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, lot, barcode, NDC..."
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
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {["All", "Expired", "Critical", "Warning", "Healthy", "Unknown"].map((status) => (
                <option key={status} value={status}>
                  {status}
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
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Medication</th>
                <th className="px-4 py-3">Lot</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3">Days Left</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">DEA</th>
                <th className="px-4 py-3">On Hand</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    No expiration rows match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t align-top text-sm text-slate-700">
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
                    <td className="px-4 py-3">{row.lotNumber || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(row.expirationDate)}
                    </td>
                    <td className="px-4 py-3">
                      {row.daysUntilExpiration === null ? "-" : row.daysUntilExpiration}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.location || "-"}</td>
                    <td className="px-4 py-3">{row.deaSchedule || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.onHandQuantity}
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
