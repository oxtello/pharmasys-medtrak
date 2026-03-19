"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VarianceRow = {
  id: string;
  timestamp: string;
  medicationName: string;
  strength?: string | null;
  dosageForm?: string | null;
  barcode?: string | null;
  deaSchedule?: string | null;
  locationId?: string | null;
  locationName: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  notes?: string | null;
  countedBy?: string | null;
  inventoryUnit?: string | null;
};

type LocationOption = {
  id: string;
  name: string;
};

type VarianceApiRow = {
  id?: string;
  occurredAt?: string;
  medicationName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  barcode?: string | null;
  deaSchedule?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  expectedCount?: number | string | null;
  actualCount?: number | string | null;
  variance?: number | string | null;
  comment?: string | null;
  countedBy?: string | null;
  inventoryUnit?: string | null;
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function csvEscape(value: unknown) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeApiRows(rows: VarianceApiRow[]): VarianceRow[] {
  return rows.map((row, index) => ({
    id: row.id || `${row.occurredAt || "row"}-${row.barcode || "unknown"}-${index}`,
    timestamp: row.occurredAt || "",
    medicationName: row.medicationName || "Unknown medication",
    strength: row.strength || "",
    dosageForm: row.dosageForm || "",
    barcode: row.barcode || "",
    deaSchedule: row.deaSchedule || "",
    locationId: row.locationId || "",
    locationName: row.locationName || "Unknown location",
    expectedQuantity: toNumber(row.expectedCount),
    countedQuantity: toNumber(row.actualCount),
    variance: toNumber(row.variance),
    notes: row.comment || "",
    countedBy: row.countedBy || "",
    inventoryUnit: row.inventoryUnit || "",
  }));
}

export default function VarianceReviewPage() {
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("All");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("All");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        const data = await res.json();
        const list = Array.isArray(data.locations)
          ? data.locations
          : Array.isArray(data)
            ? data
            : [];

        setLocations(list);
      } catch (error) {
        console.error("Failed to load locations", error);
      }
    }

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().slice(0, 10));
    setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));

    loadLocations();
  }, []);

  async function loadVarianceRows() {
    setIsLoading(true);

    try {
      const params = new URLSearchParams();

      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (locationId !== "All") params.set("locationId", locationId);
      if (search.trim()) params.set("search", search.trim());
      if (userSearch.trim()) params.set("countedBy", userSearch.trim());
      if (scheduleFilter !== "All") params.set("deaSchedule", scheduleFilter);
      if (discrepancyOnly) params.set("discrepancyOnly", "true");

      const res = await fetch(
        `/api/reports/variance-review?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      const nextRows = Array.isArray(data.rows)
        ? normalizeApiRows(data.rows)
        : [];

      setRows(nextRows);
    } catch (error) {
      console.error("Failed to load variance review", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!startDate || !endDate) return;
    loadVarianceRows();
  }, [startDate, endDate]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
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
      const scheduleText = String(row.deaSchedule || "").toUpperCase();

      const rowDate = row.timestamp ? new Date(row.timestamp) : null;
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

      const matchesMedication =
        !search.trim() || medicationText.includes(search.trim().toLowerCase());

      const matchesUser =
        !userSearch.trim() ||
        countedByText.includes(userSearch.trim().toLowerCase());

      const matchesSchedule =
        scheduleFilter === "All" || scheduleText === scheduleFilter;

      const matchesDiscrepancy =
        !discrepancyOnly || Number(row.variance || 0) !== 0;

      const matchesLocation =
        locationId === "All" || row.locationId === locationId;

      const matchesStart =
        !start ||
        !rowDate ||
        (!Number.isNaN(rowDate.getTime()) && rowDate >= start);

      const matchesEnd =
        !end ||
        !rowDate ||
        (!Number.isNaN(rowDate.getTime()) && rowDate <= end);

      return (
        matchesMedication &&
        matchesUser &&
        matchesSchedule &&
        matchesDiscrepancy &&
        matchesLocation &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    rows,
    search,
    userSearch,
    scheduleFilter,
    discrepancyOnly,
    locationId,
    startDate,
    endDate,
  ]);

  const summary = useMemo(() => {
    const totalRows = filteredRows.length;
    const discrepancyRows = filteredRows.filter(
      (row) => Number(row.variance || 0) !== 0
    ).length;
    const controlledRows = filteredRows.filter((row) =>
      ["C2", "C3", "C4", "C5"].includes(
        String(row.deaSchedule || "").toUpperCase()
      )
    ).length;
    const absoluteVariance = filteredRows.reduce(
      (sum, row) => sum + Math.abs(Number(row.variance || 0)),
      0
    );

    return {
      totalRows,
      discrepancyRows,
      controlledRows,
      absoluteVariance,
    };
  }, [filteredRows]);

  function exportCsv() {
    const header = [
      "Date",
      "Medication",
      "Strength",
      "Dosage Form",
      "Barcode",
      "DEA Schedule",
      "Location",
      "Expected Quantity",
      "Counted Quantity",
      "Variance",
      "Inventory Unit",
      "Comment",
      "Counted By",
    ];

    const lines = [
      header.join(","),
      ...filteredRows.map((row) =>
        [
          csvEscape(formatDateTime(row.timestamp)),
          csvEscape(row.medicationName),
          csvEscape(row.strength || ""),
          csvEscape(row.dosageForm || ""),
          csvEscape(row.barcode || ""),
          csvEscape(row.deaSchedule || ""),
          csvEscape(row.locationName),
          csvEscape(formatNumber(row.expectedQuantity)),
          csvEscape(formatNumber(row.countedQuantity)),
          csvEscape(formatNumber(row.variance)),
          csvEscape(row.inventoryUnit || ""),
          csvEscape(row.notes || ""),
          csvEscape(row.countedBy || ""),
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "medtrak-variance-review.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Variance Review
          </h1>
          <p className="text-sm text-slate-600">
            Review cycle count discrepancies and variance trends across
            locations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/reports/diversion-control"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back
          </Link>
          <button
            onClick={exportCsv}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border px-3 py-2"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border px-3 py-2"
          />

          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="All">All Locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medication"
            className="rounded border px-3 py-2"
          />

          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search counted by"
            className="rounded border px-3 py-2"
          />

          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="All">All Schedules</option>
            <option value="C2">C2</option>
            <option value="C3">C3</option>
            <option value="C4">C4</option>
            <option value="C5">C5</option>
            <option value="">Non-controlled</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={() => setDiscrepancyOnly((prev) => !prev)}
            />
            Discrepancies only
          </label>

          <button
            onClick={loadVarianceRows}
            className="rounded bg-slate-900 px-4 py-2 text-white"
          >
            {isLoading ? "Loading..." : "Run Review"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Rows</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary.totalRows}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Discrepancy Rows
          </p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">
            {summary.discrepancyRows}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Controlled Rows</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {summary.controlledRows}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Absolute Variance
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatNumber(summary.absoluteVariance)}
          </p>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Medication</th>
              <th className="p-3 text-left">DEA</th>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-center">Expected</th>
              <th className="p-3 text-center">Counted</th>
              <th className="p-3 text-center">Variance</th>
              <th className="p-3 text-left">Unit</th>
              <th className="p-3 text-left">Comment</th>
              <th className="p-3 text-left">Counted By</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{formatDateTime(row.timestamp)}</td>
                <td className="p-3">
                  <div className="font-medium text-slate-900">
                    {row.medicationName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[row.strength, row.dosageForm, row.barcode]
                      .filter(Boolean)
                      .join(" • ") || "-"}
                  </div>
                </td>
                <td className="p-3">{row.deaSchedule || "-"}</td>
                <td className="p-3">{row.locationName}</td>
                <td className="p-3 text-center">
                  {formatNumber(row.expectedQuantity)}
                </td>
                <td className="p-3 text-center">
                  {formatNumber(row.countedQuantity)}
                </td>
                <td
                  className={`p-3 text-center font-medium ${
                    Number(row.variance || 0) !== 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {formatNumber(row.variance)}
                </td>
                <td className="p-3">{row.inventoryUnit || "-"}</td>
                <td className="p-3">{row.notes || "-"}</td>
                <td className="p-3">{row.countedBy || "-"}</td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  No variance review rows found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
