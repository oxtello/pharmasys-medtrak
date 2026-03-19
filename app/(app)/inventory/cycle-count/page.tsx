"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

type OnHandResponse = {
  medication: {
    id: string;
    name: string;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    barcode?: string | null;
    ndc?: string | null;
    deaSchedule?: string | null;
    inventoryUnit?: string | null;
  };
  location: LocationOption;
  onHand: number;
  inventoryUnit: string;
};

type SavedCycleCountRecord = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  locationId: string;
  locationName: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  inventoryUnit: string;
  countedBy: string;
  notes: string;
  timestamp: string;
};

function normalizeDeaSchedule(value?: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["C1", "CI"].includes(normalized)) return "C1";
  if (["C2", "CII"].includes(normalized)) return "C2";
  if (["C3", "CIII"].includes(normalized)) return "C3";
  if (["C4", "CIV"].includes(normalized)) return "C4";
  if (["C5", "CV"].includes(normalized)) return "C5";
  return normalized;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function CycleCountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [actualCount, setActualCount] = useState("");
  const [comment, setComment] = useState("");
  const [countedBy, setCountedBy] = useState("");
  const [lookup, setLookup] = useState<OnHandResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [taskId, setTaskId] = useState("");
  const [prefillSearch, setPrefillSearch] = useState("");

  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        const data = await res.json();

        const nextLocations = Array.isArray(data.locations) ? data.locations : [];
        setLocations(nextLocations);

        const urlLocationId = searchParams.get("locationId") || "";
        if (
          urlLocationId &&
          nextLocations.some((location) => location.id === urlLocationId)
        ) {
          setLocationId(urlLocationId);
        } else if (nextLocations.length > 0) {
          setLocationId(nextLocations[0].id);
        }
      } catch (error) {
        console.error("Failed to load locations", error);
        setErrorMessage("Failed to load locations");
      }
    }

    loadLocations();

    if (typeof window !== "undefined") {
      const savedName =
        localStorage.getItem("medtrak-cycle-count-user") ||
        localStorage.getItem("medtrak-current-user-name") ||
        "";
      setCountedBy(savedName);
    }

    setTaskId(searchParams.get("taskId") || "");
    setPrefillSearch(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setLookup(null);
    setActualCount("");
    setComment("");
    setErrorMessage("");
    setSuccessMessage("");
  }, [barcode, locationId]);

  async function handleLookup() {
    if (!barcode.trim()) {
      setErrorMessage("Enter a barcode first.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Select a location first.");
      return;
    }

    setLookupLoading(true);
    setLookup(null);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const requestUrl =
        "/api/inventory/on-hand/by-barcode?barcode=" +
        encodeURIComponent(barcode.trim()) +
        "&locationId=" +
        encodeURIComponent(locationId);

      const res = await fetch(requestUrl, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to load expected quantity");
        return;
      }

      setLookup(data);
    } catch (error) {
      console.error("Lookup failed", error);
      setErrorMessage("Failed to load expected quantity");
    } finally {
      setLookupLoading(false);
    }
  }

  const variance = useMemo(() => {
    if (!lookup || actualCount === "") return "";
    return toNumber(actualCount) - toNumber(lookup.onHand);
  }, [lookup, actualCount]);

  const commentRequired = variance !== "" && Number(variance) !== 0;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!lookup) {
      setErrorMessage("Load expected quantity first.");
      return;
    }

    if (actualCount === "") {
      setErrorMessage("Enter actual count.");
      return;
    }

    if (toNumber(actualCount) < 0) {
      setErrorMessage("Actual count cannot be negative.");
      return;
    }

    if (!countedBy.trim()) {
      setErrorMessage("Counted by is required.");
      return;
    }

    if (commentRequired && !comment.trim()) {
      setErrorMessage("Comment is required when variance exists.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const existing =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("medtrak-cycle-count-log") || "[]")
          : [];

      const record: SavedCycleCountRecord = {
        barcode: barcode.trim(),
        medicationName: lookup.medication.name,
        strength: lookup.medication.strength || "",
        dosageForm: lookup.medication.dosageForm || "",
        manufacturer: lookup.medication.manufacturer || "",
        ndc: lookup.medication.ndc || "",
        deaSchedule: normalizeDeaSchedule(lookup.medication.deaSchedule),
        locationId: lookup.location.id,
        locationName: lookup.location.name,
        expectedQuantity: toNumber(lookup.onHand),
        actualQuantity: toNumber(actualCount),
        variance: Number(variance),
        inventoryUnit:
          lookup.inventoryUnit || lookup.medication.inventoryUnit || "",
        countedBy: countedBy.trim(),
        notes: comment.trim(),
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(
        "medtrak-cycle-count-log",
        JSON.stringify([record, ...existing])
      );
      localStorage.setItem("medtrak-cycle-count-user", countedBy.trim());

      if (taskId) {
        const completeRes = await fetch(
          `/api/cycle-count-tasks/${encodeURIComponent(taskId)}/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
body: JSON.stringify({
  countedBy: countedBy.trim(),
  expectedQuantity: toNumber(lookup.onHand),
  actualQuantity: toNumber(actualCount),
  variance: Number(variance),
  notes: comment.trim(),
}),
          }
        );

        if (!completeRes.ok) {
          const completeData = await completeRes.json().catch(() => ({}));
          throw new Error(
            completeData.error || "Failed to complete cycle count task."
          );
        }
      }

      setSuccessMessage(
        taskId
          ? "Cycle count saved and task completed."
          : "Cycle count saved."
      );

router.push("/reports/diversion-control/variance-review");
    } catch (error) {
      console.error("Save failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save cycle count."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Cycle Count / Reconciliation
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Load expected quantity from the ledger, enter the physical count, and
          document any variance.
        </p>

        {taskId || prefillSearch ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {taskId ? (
              <div>
                <span className="font-semibold">Cycle count task:</span> {taskId}
              </div>
            ) : null}
            {prefillSearch ? (
              <div className={taskId ? "mt-1" : ""}>
                <span className="font-semibold">Scheduled medication:</span>{" "}
                {prefillSearch}
              </div>
            ) : null}
            <div className="mt-1 text-blue-700">
              Scan the medication barcode for the scheduled item and complete the
              physical count.
            </div>
          </div>
        ) : null}
      </div>

      <div className="max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` (${location.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Counted By
              </label>
              <input
                type="text"
                value={countedBy}
                onChange={(e) => setCountedBy(e.target.value)}
                placeholder="Enter staff name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>

            {prefillSearch ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Scheduled Medication
                </label>
                <input
                  type="text"
                  readOnly
                  value={prefillSearch}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
                />
              </div>
            ) : null}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Barcode
              </label>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan medication barcode"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || !barcode.trim() || !locationId}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookupLoading ? "Loading..." : "Load Expected Count"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Medication
              </label>
              <input
                type="text"
                readOnly
                value={lookup?.medication.name ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Strength
              </label>
              <input
                type="text"
                readOnly
                value={lookup?.medication.strength ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Dosage Form
              </label>
              <input
                type="text"
                readOnly
                value={lookup?.medication.dosageForm ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                DEA Schedule
              </label>
              <input
                type="text"
                readOnly
                value={normalizeDeaSchedule(lookup?.medication.deaSchedule) || ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Inventory Unit
              </label>
              <input
                type="text"
                readOnly
                value={
                  lookup?.inventoryUnit ?? lookup?.medication.inventoryUnit ?? ""
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Expected Quantity
              </label>
              <input
                type="text"
                readOnly
                value={lookup ? String(lookup.onHand) : ""}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Actual Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={actualCount}
                onChange={(e) => setActualCount(e.target.value)}
                placeholder="Enter physical count"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Variance
              </label>
              <input
                type="text"
                readOnly
                value={variance === "" ? "" : String(variance)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Comment
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  commentRequired
                    ? "Required because variance exists"
                    : "Optional note"
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/inventory"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Cycle Count"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
