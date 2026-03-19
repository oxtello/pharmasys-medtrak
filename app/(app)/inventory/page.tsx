"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InventoryApiRow = {
  medicationId: string;
  barcode?: string | null;
  name?: string;
  medicationName?: string;
  strength?: string | null;
  dosageForm?: string | null;
  ndc?: string | null;
  manufacturer?: string | null;
  inventoryUnit?: string | null;
  locationId?: string;
  locationName?: string;
  quantity?: number | string;
  status?: string | null;
};

type InventoryApiItem = {
  medicationId: string;
  medicationName: string;
  strength: string | null;
  dosageForm: string | null;
  barcode: string | null;
  manufacturer: string | null;
  ndc: string | null;
  totalOnHand: number | string;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    received: number | string;
    dispensed: number | string;
    adjusted: number | string;
    wasted: number | string;
    disposed: number | string;
    onHand: number | string;
  }>;
};

type NormalizedRow = {
  medicationId: string;
  barcode: string | null;
  name: string;
  strength: string | null;
  dosageForm: string | null;
  ndc: string | null;
  manufacturer: string | null;
  inventoryUnit: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
  status: string | null;
};

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getInventoryHealth(
  status: string | null,
  quantity: number
): { label: string; className: string } {
  const normalized = (status ?? "").toUpperCase();

  if (quantity <= 0) {
    return {
      label: "Out",
      className: "bg-red-100 text-red-700 border border-red-200",
    };
  }

  if (normalized === "CRITICAL" || quantity <= 10) {
    return {
      label: "Critical",
      className: "bg-red-100 text-red-700 border border-red-200",
    };
  }

  if (normalized === "LOW" || quantity <= 25) {
    return {
      label: "Low",
      className: "bg-amber-100 text-amber-700 border border-amber-200",
    };
  }

  return {
    label: "Healthy",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  };
}

function normalizeApiData(data: any): NormalizedRow[] {
  if (Array.isArray(data?.inventory)) {
    return data.inventory.map((row: InventoryApiRow) => ({
      medicationId: row.medicationId,
      barcode: row.barcode ?? null,
      name: row.name ?? row.medicationName ?? "Unknown medication",
      strength: row.strength ?? null,
      dosageForm: row.dosageForm ?? null,
      ndc: row.ndc ?? null,
      manufacturer: row.manufacturer ?? null,
      inventoryUnit: row.inventoryUnit ?? null,
      locationId: row.locationId ?? "unknown",
      locationName: row.locationName ?? "Unknown",
      quantity: toNumber(row.quantity),
      status: row.status ?? null,
    }));
  }

  if (Array.isArray(data?.items)) {
    const rows: NormalizedRow[] = [];

    for (const item of data.items as InventoryApiItem[]) {
      for (const loc of item.byLocation ?? []) {
        const qty = toNumber(loc.onHand);
        rows.push({
          medicationId: item.medicationId,
          barcode: item.barcode ?? null,
          name: item.medicationName ?? "Unknown medication",
          strength: item.strength ?? null,
          dosageForm: item.dosageForm ?? null,
          ndc: item.ndc ?? null,
          manufacturer: item.manufacturer ?? null,
          inventoryUnit: null,
          locationId: loc.locationId,
          locationName: loc.locationName,
          quantity: qty,
          status: qty <= 10 ? "CRITICAL" : qty <= 25 ? "LOW" : "HEALTHY",
        });
      }
    }

    return rows;
  }

  return [];
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<NormalizedRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInventory() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/inventory/on-hand", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load inventory");
        }

        setInventory(normalizeApiData(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inventory");
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, []);

  const locations = useMemo(() => {
    const map = new Map<string, string>();

    for (const row of inventory) {
      map.set(row.locationId, row.locationName);
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const q = search.trim().toLowerCase();

    return inventory.filter((row) => {
      const matchesLocation =
        selectedLocationId === "all" || row.locationId === selectedLocationId;

      const matchesSearch =
        q.length === 0 ||
        row.name.toLowerCase().includes(q) ||
        (row.strength ?? "").toLowerCase().includes(q) ||
        (row.dosageForm ?? "").toLowerCase().includes(q) ||
        (row.barcode ?? "").toLowerCase().includes(q) ||
        (row.ndc ?? "").toLowerCase().includes(q);

      return matchesLocation && matchesSearch;
    });
  }, [inventory, search, selectedLocationId]);

  const totalUnits = useMemo(() => {
    return filteredInventory.reduce((sum, row) => sum + row.quantity, 0);
  }, [filteredInventory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live on-hand inventory by location.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/inventory/add-medication" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Add Medication</Link>
          <Link href="/inventory/receive" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Receive Stock</Link>
          <Link href="/inventory/dispense" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Dispense</Link>
          <Link href="/inventory/adjust" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">Adjust</Link>
          <Link href="/inventory/waste" className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Waste</Link>
          <Link href="/inventory/dispose" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">Dispose</Link>
          <Link href="/inventory/transfer" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">Transfer</Link>
          <Link href="/inventory/cycle-count" className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">Cycle Count</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Inventory lines</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{filteredInventory.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total units on hand</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalUnits}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Location view</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {selectedLocationId === "all"
              ? "All active locations"
              : locations.find((loc) => loc.id === selectedLocationId)?.name ?? "Selected location"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Medication, strength, barcode, NDC..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
            >
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading inventory...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No inventory records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-sm text-slate-600">
                  <th className="px-4 py-3 font-medium">Medication</th>
                  <th className="px-4 py-3 font-medium">Barcode</th>
                  <th className="px-4 py-3 font-medium">NDC</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">On Hand</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((row, index) => {
                  const health = getInventoryHealth(row.status, row.quantity);

                  return (
                    <tr key={`${row.medicationId}-${row.locationId}-${index}`} className="text-sm text-slate-700">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">
                          {[row.strength, row.dosageForm, row.manufacturer].filter(Boolean).join(" • ")}
                        </div>
                      </td>
                      <td className="px-4 py-4">{row.barcode ?? "-"}</td>
                      <td className="px-4 py-4">{row.ndc ?? "-"}</td>
                      <td className="px-4 py-4">{row.locationName}</td>
                      <td className="px-4 py-4">{row.inventoryUnit ?? "-"}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{row.quantity}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${health.className}`}>
                          {health.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
