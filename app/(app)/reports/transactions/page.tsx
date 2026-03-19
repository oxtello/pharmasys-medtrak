"use client";

import { useEffect, useState } from "react";

type TransactionRow = {
  id: string;
  occurredAt: string;
  type: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  barcode: string;
  ndc: string;
  locationId: string;
  locationName: string;
  quantity: number;
  inventoryUnit: string;
  deaSchedule: string;
  actorName: string;
  note: string;
  referenceId: string;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string;
};

const TYPE_OPTIONS = [
  "",
  "RECEIVE",
  "DISPENSE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "WASTE",
  "DISPOSE",
  "ADJUST_ADD",
  "ADJUST_SUBTRACT",
  "CYCLE_COUNT",
];

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatQuantity(value: number, unit?: string) {
  const qty = Number.isFinite(value) ? value : 0;
  return `${qty} ${unit || ""}`.trim();
}

function badgeClasses(type: string) {
  switch (type) {
    case "RECEIVE":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    case "DISPENSE":
      return "bg-blue-100 text-blue-700 border border-blue-200";
    case "TRANSFER_OUT":
    case "TRANSFER_IN":
      return "bg-violet-100 text-violet-700 border border-violet-200";
    case "WASTE":
      return "bg-amber-100 text-amber-700 border border-amber-200";
    case "DISPOSE":
      return "bg-rose-100 text-rose-700 border border-rose-200";
    case "ADJUST_ADD":
    case "ADJUST_SUBTRACT":
      return "bg-orange-100 text-orange-700 border border-orange-200";
    case "CYCLE_COUNT":
      return "bg-slate-100 text-slate-700 border border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

function prettyType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TransactionsReportPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        const response = await fetch("/api/locations", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load locations");

        const data = await response.json();
        const resolvedLocations: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;
        setLocations(resolvedLocations);
      } catch (error) {
        console.error(error);
      }
    }

    loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const params = new URLSearchParams();

        if (locationId) params.set("locationId", locationId);
        if (type) params.set("type", type);
        if (search) params.set("search", search);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const queryString = params.toString();
        const url = queryString
          ? `/api/reports/transactions?${queryString}`
          : "/api/reports/transactions";

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load transaction report");
        }

        if (!isMounted) return;

        setRows(Array.isArray(data?.transactions) ? data.transactions : []);
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load transaction report"
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [locationId, type, search, startDate, endDate]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Transactions Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review immutable inventory ledger activity from the database.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Location
            </label>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.code ? ` (${location.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Type
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option || "ALL"} value={option}>
                  {option ? prettyType(option) : "All types"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Medication, barcode, actor, notes..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Ledger Rows</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Time</th>
                <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 font-medium text-slate-600">Medication</th>
                <th className="px-4 py-3 font-medium text-slate-600">Barcode</th>
                <th className="px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 font-medium text-slate-600">Quantity</th>
                <th className="px-4 py-3 font-medium text-slate-600">DEA</th>
                <th className="px-4 py-3 font-medium text-slate-600">Actor</th>
                <th className="px-4 py-3 font-medium text-slate-600">Note</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-red-600">
                    {errorMessage}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No transactions found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClasses(
                          row.type
                        )}`}
                      >
                        {prettyType(row.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.medicationName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {[row.strength, row.dosageForm, row.manufacturer]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.barcode || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.locationName || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatQuantity(row.quantity, row.inventoryUnit)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.deaSchedule || "Non-controlled"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.actorName || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.note || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
