"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InventoryRow = {
  medicationId: string;
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  deaSchedule: string;
  inventoryUnit: string;
  locationId: string;
  locationName: string;
  quantityOnHand: number;
  lotCount: number;
  earliestExpiration: string | null;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function getStatus(quantity: number) {
  if (quantity <= 0) return "Out";
  if (quantity <= 5) return "Critical";
  if (quantity <= 10) return "Low";
  return "Healthy";
}

function badgeClass(status: string) {
  if (status === "Healthy") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Low") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

export default function OnHandReportPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        const response = await fetch("/api/locations", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load locations");
        }

        const data = await response.json();
        const resolved: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;
        setLocations(resolved);
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
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const params = new URLSearchParams();
        if (locationId) params.set("locationId", locationId);
        if (search) params.set("search", search);

        const queryString = params.toString();
        const url = queryString
          ? `/api/inventory/on-hand?${queryString}`
          : "/api/inventory/on-hand";

        const response = await fetch(url, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load on-hand report");
        }

        const data = await response.json();
        const resolvedRows: InventoryRow[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : [];

        if (!isMounted) return;
        setRows(resolvedRows);
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load on-hand report"
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [locationId, search]);

  const summary = useMemo(() => {
    const totalQuantity = rows.reduce(
      (sum, row) => sum + Number(row.quantityOnHand || 0),
      0
    );

    const controlled = rows.filter((row) => row.deaSchedule?.trim()).length;

    return {
      medicationCount: rows.length,
      totalQuantity,
      controlled,
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              On-Hand Inventory Report
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ledger-derived inventory by medication and location.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/reports"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to Reports
            </Link>
            <Link
              href="/inventory"
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open Inventory
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Medication Rows"
          value={String(summary.medicationCount)}
        />
        <SummaryCard
          label="Total Units On Hand"
          value={formatQuantity(summary.totalQuantity)}
        />
        <SummaryCard
          label="Controlled Rows"
          value={String(summary.controlled)}
        />
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
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

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search medication, barcode, NDC, manufacturer..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Report Results</h2>
          <p className="mt-1 text-sm text-slate-500">
            This report and the main Inventory screen use the same API source.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Medication</th>
                <th className="px-4 py-3 font-medium text-slate-600">Barcode</th>
                <th className="px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 font-medium text-slate-600">On Hand</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">DEA</th>
                <th className="px-4 py-3 font-medium text-slate-600">Lots</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  Earliest Exp.
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Loading report…
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-red-600">
                    {errorMessage}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No inventory found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = getStatus(Number(row.quantityOnHand || 0));

                  return (
                    <tr
                      key={`${row.medicationId}-${row.locationId}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {row.medicationName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[row.strength, row.dosageForm, row.manufacturer]
                            .filter(Boolean)
                            .join(" • ") || "—"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          NDC: {row.ndc || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{row.barcode || "—"}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.locationName || "—"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {formatQuantity(Number(row.quantityOnHand || 0))}{" "}
                        {row.inventoryUnit || ""}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.deaSchedule || "Non-controlled"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{row.lotCount}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(row.earliestExpiration)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
