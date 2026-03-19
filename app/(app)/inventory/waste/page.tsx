"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

type MedicationPayload = {
  id: string;
  name: string;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  deaSchedule?: string | null;
  inventoryUnit?: string | null;
};

type OnHandResponse = {
  medication: MedicationPayload;
  location: LocationOption;
  onHand: number;
  inventoryUnit: string;
};

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function isControlledSubstance(deaSchedule?: string | null) {
  const normalized = normalizeText(deaSchedule).toUpperCase();
  return ["C2", "C3", "C4", "C5"].includes(normalized);
}

function getDeaBadgeClasses(deaSchedule?: string | null) {
  return isControlledSubstance(deaSchedule)
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

export default function WastePage() {
  const router = useRouter();

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState("Damaged");
  const [note, setNote] = useState("");
  const [witnessId, setWitnessId] = useState("");
  const [witnessName, setWitnessName] = useState("");

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lookup, setLookup] = useState<OnHandResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        setLocationsLoading(true);

        const res = await fetch("/api/locations", {
          cache: "no-store",
        });

        const data = await res.json();
        const nextLocations: LocationOption[] = Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;

        setLocations(nextLocations);

        if (nextLocations.length > 0) {
          setLocationId((current) => current || nextLocations[0].id);
        }
      } catch (error) {
        console.error("Failed to load locations", error);
        if (!isMounted) return;
        setErrorMessage("Failed to load locations.");
      } finally {
        if (isMounted) {
          setLocationsLoading(false);
        }
      }
    }

    loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLookup(null);
    setQuantity("");
    setWitnessId("");
    setWitnessName("");
    setErrorMessage("");
    setSuccessMessage("");
  }, [locationId]);

  useEffect(() => {
    setLookup(null);
    setQuantity("");
    setWitnessId("");
    setWitnessName("");
    setErrorMessage("");
    setSuccessMessage("");
  }, [barcode]);

  const requiresWitness = useMemo(() => {
    return isControlledSubstance(lookup?.medication?.deaSchedule);
  }, [lookup]);

  const witnessSatisfied = useMemo(() => {
    if (!requiresWitness) return true;
    return Boolean(normalizeText(witnessId) || normalizeText(witnessName));
  }, [requiresWitness, witnessId, witnessName]);

  const cleanBarcode = normalizeText(barcode);
  const numericQuantity = Number(quantity);

  const canLookup = Boolean(locationId && cleanBarcode);
  const canSubmit =
    !loading &&
    !lookupLoading &&
    Boolean(lookup) &&
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0 &&
    witnessSatisfied;

  async function handleLookup() {
    if (!locationId || !cleanBarcode) {
      setErrorMessage("Select a location and scan a barcode first.");
      setLookup(null);
      return;
    }

    setLookupLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setWitnessId("");
    setWitnessName("");

    try {
      const res = await fetch(
        `/api/inventory/on-hand/by-barcode?barcode=${encodeURIComponent(
          cleanBarcode
        )}&locationId=${encodeURIComponent(locationId)}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setLookup(null);
        setErrorMessage(data?.error || "Failed to load on-hand inventory");
        return;
      }

      setLookup(data);
    } catch (error) {
      console.error("Failed to load on-hand inventory", error);
      setLookup(null);
      setErrorMessage("Failed to load on-hand inventory");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!lookup) {
      setErrorMessage("Load on-hand inventory before saving waste.");
      return;
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setErrorMessage("Enter a valid waste quantity.");
      return;
    }

    if (numericQuantity > Number(lookup.onHand || 0)) {
      setErrorMessage("No on-hand inventory available for this waste amount.");
      return;
    }

    if (!normalizeText(reasonCode)) {
      setErrorMessage("Select a waste reason.");
      return;
    }

    if (!witnessSatisfied) {
      setErrorMessage("Witness is required for DEA scheduled medication waste.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/inventory/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: cleanBarcode,
          locationId,
          quantity: numericQuantity,
          reasonCode: normalizeText(reasonCode),
          note: normalizeText(note),
          witnessUserId: normalizeText(witnessId) || undefined,
          witnessName: normalizeText(witnessName) || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error || "Failed to waste medication");
        return;
      }

      setSuccessMessage("Waste recorded successfully.");
      setQuantity("");
      setNote("");
      setWitnessId("");
      setWitnessName("");

      await handleLookup();

      setTimeout(() => {
        router.push("/reports/transactions");
      }, 800);
    } catch (error) {
      console.error("Failed to waste medication", error);
      setErrorMessage("Failed to waste medication");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Waste Medication</h1>
        <p className="mt-2 text-slate-600">
          Scan a medication, verify on-hand quantity from the ledger, and record
          administered or partial-dose waste.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={locationsLoading}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              >
                <option value="">
                  {locationsLoading ? "Loading locations..." : "Select location"}
                </option>
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
                Barcode
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan barcode"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || !canLookup}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {lookupLoading ? "Loading..." : "Lookup"}
                </button>
              </div>
            </div>
          </div>

          {lookup ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-500">Medication</p>
                  <p className="font-medium text-slate-900">{lookup.medication.name}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Strength / Form</p>
                  <p className="font-medium text-slate-900">
                    {lookup.medication.strength || "-"} /{" "}
                    {lookup.medication.dosageForm || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">DEA Schedule</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getDeaBadgeClasses(
                        lookup.medication.deaSchedule
                      )}`}
                    >
                      {lookup.medication.deaSchedule || "Non-controlled"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-500">On-Hand</p>
                  <p className="font-medium text-slate-900">
                    {formatQuantity(Number(lookup.onHand || 0))} {lookup.inventoryUnit}
                  </p>
                </div>
              </div>

              {requiresWitness ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  This medication is DEA scheduled. A witness is required before
                  waste can be saved.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Quantity to Waste
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Reason
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              >
                <option value="Damaged">Damaged</option>
                <option value="Partial Dose">Partial Dose</option>
                <option value="Spill">Spill</option>
                <option value="Contaminated">Contaminated</option>
                <option value="Expired During Use">Expired During Use</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {requiresWitness ? (
            <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-rose-900">
                    Witness Verification Required
                  </h2>
                  <p className="mt-1 text-sm text-rose-700">
                    Enter a witness user id or witness name before saving this
                    waste event.
                  </p>
                </div>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                    witnessSatisfied
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-white text-rose-700"
                  }`}
                >
                  {witnessSatisfied ? "Witness captured" : "Witness required"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Witness User ID
                  </label>
                  <input
                    type="text"
                    value={witnessId}
                    onChange={(e) => setWitnessId(e.target.value)}
                    placeholder="Enter witness user id"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Witness Name
                  </label>
                  <input
                    type="text"
                    value={witnessName}
                    onChange={(e) => setWitnessName(e.target.value)}
                    placeholder="Optional if witness user id is entered"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700">Note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
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

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Waste"}
            </button>

            {requiresWitness && !witnessSatisfied ? (
              <p className="text-sm text-rose-600">
                Witness must be entered before save.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
