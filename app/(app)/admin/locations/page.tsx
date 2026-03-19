"use client";

import { useMemo, useState } from "react";

type LocationRecord = {
  id: string;
  name: string;
  code: string;
  type: "Clinic" | "Hospital" | "Pharmacy" | "Storage";
  address: string;
  active: boolean;
};

const INITIAL_LOCATIONS: LocationRecord[] = [
  {
    id: "LOC-001",
    name: "Main Campus",
    code: "MAIN",
    type: "Hospital",
    address: "100 Main St",
    active: true,
  },
  {
    id: "LOC-002",
    name: "Downtown Clinic",
    code: "DTCL",
    type: "Clinic",
    address: "250 Market Ave",
    active: true,
  },
  {
    id: "LOC-003",
    name: "North Pharmacy",
    code: "NPHR",
    type: "Pharmacy",
    address: "88 North Blvd",
    active: true,
  },
  {
    id: "LOC-004",
    name: "Backup Storage",
    code: "BSTO",
    type: "Storage",
    address: "12 Warehouse Rd",
    active: false,
  },
];

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<LocationRecord[]>(INITIAL_LOCATIONS);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "All" | "Clinic" | "Hospital" | "Pharmacy" | "Storage"
  >("All");

  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "Clinic" as LocationRecord["type"],
    address: "",
    active: true,
  });

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const matchesSearch =
        location.name.toLowerCase().includes(search.toLowerCase()) ||
        location.code.toLowerCase().includes(search.toLowerCase()) ||
        location.address.toLowerCase().includes(search.toLowerCase());

      const matchesType =
        typeFilter === "All" ? true : location.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [locations, search, typeFilter]);

  function handleAddLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) return;

    const newLocation: LocationRecord = {
      id: `LOC-${String(locations.length + 1).padStart(3, "0")}`,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      address: form.address.trim(),
      active: form.active,
    };

    setLocations((prev) => [newLocation, ...prev]);

    setForm({
      name: "",
      code: "",
      type: "Clinic",
      address: "",
      active: true,
    });
  }

  function toggleActive(id: string) {
    setLocations((prev) =>
      prev.map((location) =>
        location.id === id
          ? { ...location, active: !location.active }
          : location
      )
    );
  }

  function updateType(id: string, type: LocationRecord["type"]) {
    setLocations((prev) =>
      prev.map((location) =>
        location.id === id ? { ...location, type } : location
      )
    );
  }

  const stats = {
    total: locations.length,
    active: locations.filter((l) => l.active).length,
    clinics: locations.filter((l) => l.type === "Clinic").length,
    hospitals: locations.filter((l) => l.type === "Hospital").length,
    pharmacies: locations.filter((l) => l.type === "Pharmacy").length,
    storage: locations.filter((l) => l.type === "Storage").length,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Admin / Locations</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Location Management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage organization locations. Users will be able to edit only their
              home location and view all other locations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Active" value={stats.active} />
            <StatCard label="Clinics" value={stats.clinics} />
            <StatCard label="Hospitals" value={stats.hospitals} />
            <StatCard label="Pharmacies" value={stats.pharmacies} />
            <StatCard label="Storage" value={stats.storage} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add Location</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a new organization location for inventory visibility and access control.
          </p>

          <form onSubmit={handleAddLocation} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Location Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="South Clinic"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="SCLN"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as LocationRecord["type"],
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="Clinic">Clinic</option>
                <option value="Hospital">Hospital</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Storage">Storage</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Address
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="123 Example St"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Set location as active
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Save Location
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Current Locations
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                View and manage locations across the organization.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              />

              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(
                    e.target.value as
                      | "All"
                      | "Clinic"
                      | "Hospital"
                      | "Pharmacy"
                      | "Storage"
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="All">All Types</option>
                <option value="Clinic">Clinic</option>
                <option value="Hospital">Hospital</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Storage">Storage</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((location) => (
                  <tr key={location.id} className="bg-slate-50">
                    <td className="rounded-l-2xl px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {location.name}
                      </div>
                      <div className="text-sm text-slate-600">{location.code}</div>
                      <div className="text-xs text-slate-500">{location.id}</div>
                    </td>

                    <td className="px-3 py-3">
                      <select
                        value={location.type}
                        onChange={(e) =>
                          updateType(
                            location.id,
                            e.target.value as LocationRecord["type"]
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="Clinic">Clinic</option>
                        <option value="Hospital">Hospital</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Storage">Storage</option>
                      </select>
                    </td>

                    <td className="px-3 py-3 text-sm text-slate-700">
                      {location.address}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          location.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {location.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="rounded-r-2xl px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(location.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {location.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredLocations.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-sm text-slate-500"
                    >
                      No locations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-4 py-3 text-center">
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
