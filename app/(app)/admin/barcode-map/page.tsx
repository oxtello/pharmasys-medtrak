"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DeaSchedule = "" | "C2" | "C3" | "C4" | "C5";

type BarcodeMapRecord = {
  id: string;
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  packageSize: string;
  deaSchedule: DeaSchedule;
  active: boolean;
  createdAt: string;
};

const STORAGE_KEY = "medtrak-barcode-map";

const SEED_DATA: BarcodeMapRecord[] = [
  {
    id: "BM-001",
    barcode: "123456789012",
    medicationName: "Morphine Sulfate",
    strength: "2 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Hospira",
    ndc: "0409-1234",
    packageSize: "10 mL vial",
    deaSchedule: "C2",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "BM-002",
    barcode: "234567890123",
    medicationName: "Lorazepam",
    strength: "1 mg",
    dosageForm: "Tablet",
    manufacturer: "Teva",
    ndc: "00093-1234",
    packageSize: "100 count bottle",
    deaSchedule: "C4",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "BM-003",
    barcode: "345678901234",
    medicationName: "Ondansetron",
    strength: "4 mg",
    dosageForm: "Tablet",
    manufacturer: "Sandoz",
    ndc: "0781-1234",
    packageSize: "30 count bottle",
    deaSchedule: "",
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function safeRead(): BarcodeMapRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BarcodeMapRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: BarcodeMapRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function matchesSearch(row: BarcodeMapRecord, search: string) {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();

  return [
    row.barcode,
    row.medicationName,
    row.strength,
    row.dosageForm,
    row.manufacturer,
    row.ndc,
    row.packageSize,
    row.deaSchedule,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export default function BarcodeMapPage() {
  const [records, setRecords] = useState<BarcodeMapRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [deaFilter, setDeaFilter] = useState<"ALL" | DeaSchedule>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [form, setForm] = useState({
    barcode: "",
    medicationName: "",
    strength: "",
    dosageForm: "",
    manufacturer: "",
    ndc: "",
    packageSize: "",
    deaSchedule: "" as DeaSchedule,
    active: true,
  });

  useEffect(() => {
    const existing = safeRead();

    if (existing.length === 0) {
      saveRecords(SEED_DATA);
      setRecords(SEED_DATA);
    } else {
      setRecords(existing);
    }

    setLoaded(true);
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((row) => {
      const searchMatch = matchesSearch(row, search);
      const deaMatch = deaFilter === "ALL" ? true : row.deaSchedule === deaFilter;
      const statusMatch =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
          ? row.active
          : !row.active;

      return searchMatch && deaMatch && statusMatch;
    });
  }, [records, search, deaFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((r) => r.active).length,
      controlled: records.filter((r) => ["C2", "C3", "C4", "C5"].includes(r.deaSchedule)).length,
      inactive: records.filter((r) => !r.active).length,
    };
  }, [records]);

  function resetForm() {
    setForm({
      barcode: "",
      medicationName: "",
      strength: "",
      dosageForm: "",
      manufacturer: "",
      ndc: "",
      packageSize: "",
      deaSchedule: "",
      active: true,
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !form.barcode.trim() ||
      !form.medicationName.trim() ||
      !form.strength.trim() ||
      !form.dosageForm.trim()
    ) {
      alert("Please complete barcode, medication name, strength, and dosage form.");
      return;
    }

    const duplicate = records.find(
      (row) => row.barcode.trim() === form.barcode.trim()
    );

    if (duplicate) {
      alert("That barcode already exists in the Barcode Map.");
      return;
    }

    const next: BarcodeMapRecord = {
      id: `BM-${String(records.length + 1).padStart(3, "0")}`,
      barcode: form.barcode.trim(),
      medicationName: form.medicationName.trim(),
      strength: form.strength.trim(),
      dosageForm: form.dosageForm.trim(),
      manufacturer: form.manufacturer.trim(),
      ndc: form.ndc.trim(),
      packageSize: form.packageSize.trim(),
      deaSchedule: form.deaSchedule,
      active: form.active,
      createdAt: new Date().toISOString(),
    };

    const updated = [next, ...records];
    setRecords(updated);
    saveRecords(updated);
    resetForm();
  }

  function toggleActive(id: string) {
    const updated = records.map((row) =>
      row.id === id ? { ...row, active: !row.active } : row
    );
    setRecords(updated);
    saveRecords(updated);
  }

  function deleteRecord(id: string) {
    const confirmed = window.confirm("Delete this barcode mapping?");
    if (!confirmed) return;

    const updated = records.filter((row) => row.id !== id);
    setRecords(updated);
    saveRecords(updated);
  }

  if (!loaded) {
    return <div className="p-8">Loading barcode map...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Admin / Barcode Map</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Barcode Mapping
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Map manufacturer barcodes to medication master records so scan-driven
              receive, dispense, waste, and reconciliation flows can auto-fill medication details.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Admin
            </Link>
            <Link
              href="/inventory/receive"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Receive
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Mappings" value={String(summary.total)} />
        <StatCard label="Active" value={String(summary.active)} />
        <StatCard label="Controlled" value={String(summary.controlled)} />
        <StatCard label="Inactive" value={String(summary.inactive)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add Barcode Mapping</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a reusable scan lookup record for inventory workflows.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Barcode
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, barcode: e.target.value }))
                }
                placeholder="Scan or type barcode"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Medication Name
              </label>
              <input
                type="text"
                value={form.medicationName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, medicationName: e.target.value }))
                }
                placeholder="Morphine Sulfate"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Strength
                </label>
                <input
                  type="text"
                  value={form.strength}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, strength: e.target.value }))
                  }
                  placeholder="2 mg/mL"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Dosage Form
                </label>
                <input
                  type="text"
                  value={form.dosageForm}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, dosageForm: e.target.value }))
                  }
                  placeholder="Injection"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, manufacturer: e.target.value }))
                  }
                  placeholder="Hospira"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  NDC
                </label>
                <input
                  type="text"
                  value={form.ndc}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ndc: e.target.value }))
                  }
                  placeholder="0409-1234"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Package Size
              </label>
              <input
                type="text"
                value={form.packageSize}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, packageSize: e.target.value }))
                }
                placeholder="10 mL vial"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  DEA Schedule
                </label>
                <select
                  value={form.deaSchedule}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      deaSchedule: e.target.value as DeaSchedule,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                >
                  <option value="">None</option>
                  <option value="C2">C2</option>
                  <option value="C3">C3</option>
                  <option value="C4">C4</option>
                  <option value="C5">C5</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 md:mt-6">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active mapping
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Save Mapping
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Mapped Barcodes</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search and manage medication barcode resolution records.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mappings"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
              <select
                value={deaFilter}
                onChange={(e) => setDeaFilter(e.target.value as "ALL" | DeaSchedule)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="ALL">All DEA</option>
                <option value="">Non-Controlled</option>
                <option value="C2">C2</option>
                <option value="C3">C3</option>
                <option value="C4">C4</option>
                <option value="C5">C5</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Barcode</th>
                  <th className="px-4 py-2">Medication</th>
                  <th className="px-4 py-2">NDC</th>
                  <th className="px-4 py-2">Package</th>
                  <th className="px-4 py-2">DEA</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No barcode mappings match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((row) => (
                    <tr key={row.id} className="align-top text-sm text-slate-700">
                      <td className="rounded-l-2xl bg-slate-50 px-4 py-3 font-mono text-xs">
                        {row.barcode}
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.medicationName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {[row.strength, row.dosageForm, row.manufacturer]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </td>

                      <td className="bg-slate-50 px-4 py-3">{row.ndc || "-"}</td>
                      <td className="bg-slate-50 px-4 py-3">{row.packageSize || "-"}</td>

                      <td className="bg-slate-50 px-4 py-3">
                        {row.deaSchedule ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {row.deaSchedule}
                          </span>
                        ) : (
                          <span className="text-slate-400">NONE</span>
                        )}
                      </td>

                      <td className="bg-slate-50 px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="rounded-r-2xl bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(row.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                          >
                            {row.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRecord(row.id)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
