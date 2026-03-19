"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { exportReportPdf } from "@/lib/exportReportPdf";

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
  deaSchedule?: string;
  receivedAt?: string;
};

type SavedDispenseRecord = {
  barcode: string;
  location: string;
  quantity: string;
};

type SavedAdjustRecord = {
  barcode: string;
  location: string;
  adjustmentType: "ADD" | "SUBTRACT";
  quantity: string;
};

type SavedTransferRecord = {
  barcode: string;
  fromLocation: string;
  toLocation: string;
  quantity: string;
};

type SavedWasteRecord = {
  barcode: string;
  location: string;
  quantity: string;
};

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
  status: "Expired" | "Expiring Soon" | "Watch" | "OK" | "No Exp Date";
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

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function daysUntil(dateString?: string): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.ceil((target.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
}

function expirationStatus(days: number | null): ExpirationRow["status"] {
  if (days === null) return "No Exp Date";
  if (days < 0) return "Expired";
  if (days <= 30) return "Expiring Soon";
  if (days <= 90) return "Watch";
  return "OK";
}

function badgeClass(status: ExpirationRow["status"]) {
  switch (status) {
    case "Expired":
      return "bg-rose-100 text-rose-700";
    case "Expiring Soon":
      return "bg-amber-100 text-amber-700";
    case "Watch":
      return "bg-blue-100 text-blue-700";
    case "OK":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ExpirationReportPage() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const reportData = useMemo(() => {
    const receives = safeRead<SavedReceiveRecord>("medtrak-received-stock");
    const dispenses = safeRead<SavedDispenseRecord>("medtrak-dispense-log");
    const adjusts = safeRead<SavedAdjustRecord>("medtrak-adjust-log");
    const transfers = safeRead<SavedTransferRecord>("medtrak-transfer-log");
    const wastes = safeRead<SavedWasteRecord>("medtrak-waste-log");
    const disposes = safeRead<SavedWasteRecord>("medtrak-dispose-log");

    const rows = new Map<string, ExpirationRow>();

    function ensureRow(base: SavedReceiveRecord) {
      const key = `${base.barcode || ""}__${base.location || ""}__${base.lotNumber || ""}__${base.expirationDate || ""}`;

      if (!rows.has(key)) {
        const days = daysUntil(base.expirationDate);
        rows.set(key, {
          id: key,
          medicationName: base.medicationName || "Unknown medication",
          strength: base.strength || "",
          dosageForm: base.dosageForm || "",
          manufacturer: base.manufacturer || "",
          barcode: base.barcode || "",
          ndc: base.ndc || "",
          lotNumber: base.lotNumber || "",
          expirationDate: base.expirationDate || "",
          location: base.location || "Unknown",
          deaSchedule: base.deaSchedule || "",
          onHandQuantity: 0,
          daysUntilExpiration: days,
          status: expirationStatus(days),
        });
      }

      return rows.get(key)!;
    }

    receives.forEach((item) => {
      const row = ensureRow(item);
      row.onHandQuantity += toNumber(item.quantityReceived);
    });

    function adjustByBarcodeLocation(
      barcode: string,
      location: string,
      delta: number
    ) {
      const matchingRows = Array.from(rows.values())
        .filter((row) => row.barcode === barcode && row.location === location)
        .sort((a, b) => {
          const aDays = a.daysUntilExpiration ?? 999999;
          const bDays = b.daysUntilExpiration ?? 999999;
          return aDays - bDays;
        });

      let remaining = Math.abs(delta);

      for (const row of matchingRows) {
        if (remaining <= 0) break;
        const available = row.onHandQuantity;
        if (available <= 0) continue;

        const take = Math.min(available, remaining);
        row.onHandQuantity -= take;
        remaining -= take;
      }
    }

    dispenses.forEach((item) => {
      adjustByBarcodeLocation(item.barcode, item.location, -toNumber(item.quantity));
    });

    adjusts.forEach((item) => {
      const qty = toNumber(item.quantity);
      if (item.adjustmentType === "SUBTRACT") {
        adjustByBarcodeLocation(item.barcode, item.location, -qty);
      }
    });

    wastes.forEach((item) => {
      adjustByBarcodeLocation(item.barcode, item.location, -toNumber(item.quantity));
    });

    disposes.forEach((item) => {
      adjustByBarcodeLocation(item.barcode, item.location, -toNumber(item.quantity));
    });

    transfers.forEach((item) => {
      adjustByBarcodeLocation(item.barcode, item.fromLocation, -toNumber(item.quantity));
    });

    const finalRows = Array.from(rows.values())
      .filter((row) => row.onHandQuantity > 0)
      .sort((a, b) => {
        const aDays = a.daysUntilExpiration ?? 999999;
        const bDays = b.daysUntilExpiration ?? 999999;
        if (aDays !== bDays) return aDays - bDays;
        return a.medicationName.localeCompare(b.medicationName);
      });

    const locations = Array.from(new Set(finalRows.map((row) => row.location))).sort();

    return { rows: finalRows, locations };
  }, []);

  const filteredRows = useMemo(() => {
    return reportData.rows.filter((row) => {
      const matchesLocation =
        locationFilter === "All" ? true : row.location === locationFilter;

      const matchesStatus =
        statusFilter === "All" ? true : row.status === statusFilter;

      const haystack = [
        row.medicationName,
        row.strength,
        row.dosageForm,
        row.manufacturer,
        row.barcode,
        row.ndc,
        row.lotNumber,
        row.location,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(search.trim().toLowerCase());

      return matchesLocation && matchesStatus && matchesSearch;
    });
  }, [reportData.rows, locationFilter, statusFilter, search]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalRows += 1;
        acc.totalOnHand += row.onHandQuantity;
        if (row.status === "Expired") acc.expired += 1;
        if (row.status === "Expiring Soon") acc.expiringSoon += 1;
        if (row.status === "Watch") acc.watch += 1;
        return acc;
      },
      {
        totalRows: 0,
        totalOnHand: 0,
        expired: 0,
        expiringSoon: 0,
        watch: 0,
      }
    );
  }, [filteredRows]);

  function downloadCsv() {
    const headers = [
      "Medication",
      "Strength",
      "Dosage Form",
      "Manufacturer",
      "Barcode",
      "NDC",
      "Lot Number",
      "Expiration Date",
      "Location",
      "DEA Schedule",
      "On Hand",
      "Days Until Expiration",
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
        row.lotNumber,
        row.expirationDate,
        row.location,
        row.deaSchedule,
        row.onHandQuantity,
        row.daysUntilExpiration === null ? "" : row.daysUntilExpiration,
        row.status,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-expiration-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    exportReportPdf({
      title: "Expiration Report",
      subtitle: `Generated ${new Date().toLocaleString()}`,
      filename: "medtrak-expiration-report.pdf",
      columns: [
        { header: "Medication", dataKey: "medicationName" },
        { header: "Strength", dataKey: "strength" },
        { header: "Form", dataKey: "dosageForm" },
        { header: "Lot", dataKey: "lotNumber" },
        { header: "Exp Date", dataKey: "expirationDate" },
        { header: "Location", dataKey: "location" },
        { header: "DEA", dataKey: "deaSchedule" },
        { header: "On Hand", dataKey: "onHandQuantity" },
        { header: "Days Left", dataKey: "daysUntilExpirationDisplay" },
        { header: "Status", dataKey: "status" },
      ],
      rows: filteredRows.map((row) => ({
        medicationName: row.medicationName,
        strength: row.strength,
        dosageForm: row.dosageForm,
        lotNumber: row.lotNumber || "-",
        expirationDate: row.expirationDate || "-",
        location: row.location,
        deaSchedule: row.deaSchedule || "-",
        onHandQuantity: row.onHandQuantity,
        daysUntilExpirationDisplay:
          row.daysUntilExpiration === null ? "-" : row.daysUntilExpiration,
        status: row.status,
      })),
    });
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Reports / Expiration</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Expiration Report
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review current inventory by lot and expiration date so expiring
              medications can be identified early.
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
            <button
              type="button"
              onClick={downloadPdf}
              className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Rows" value={formatNumber(summary.totalRows)} />
        <SummaryCard label="On Hand" value={formatNumber(summary.totalOnHand)} />
        <SummaryCard label="Expired" value={formatNumber(summary.expired)} />
        <SummaryCard
          label="Expiring ≤ 30 Days"
          value={formatNumber(summary.expiringSoon)}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, barcode, lot..."
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
              <option value="All">All Locations</option>
              {reportData.locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Expired">Expired</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Watch">Watch</option>
              <option value="OK">OK</option>
              <option value="No Exp Date">No Exp Date</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Medication</th>
                <th className="px-4 py-2">Lot</th>
                <th className="px-4 py-2">Expiration</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">DEA</th>
                <th className="px-4 py-2">On Hand</th>
                <th className="px-4 py-2">Days Left</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    No expiration rows match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="align-top text-sm text-slate-700">
                    <td className="rounded-l-2xl bg-slate-50 px-4 py-3">
                      <div className="font-medium text-slate-900">{row.medicationName}</div>
                      <div className="text-xs text-slate-500">
                        {[row.strength, row.dosageForm, row.manufacturer]
                          .filter(Boolean)
                          .join(" • ") || row.barcode || row.ndc || "-"}
                      </div>
                    </td>
                    <td className="bg-slate-50 px-4 py-3">{row.lotNumber || "-"}</td>
                    <td className="bg-slate-50 px-4 py-3">{row.expirationDate || "-"}</td>
                    <td className="bg-slate-50 px-4 py-3">{row.location}</td>
                    <td className="bg-slate-50 px-4 py-3">{row.deaSchedule || "-"}</td>
                    <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">
                      {formatNumber(row.onHandQuantity)}
                    </td>
                    <td className="bg-slate-50 px-4 py-3">
                      {row.daysUntilExpiration === null ? "-" : row.daysUntilExpiration}
                    </td>
                    <td className="rounded-r-2xl bg-slate-50 px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
