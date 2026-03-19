"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { findMedicationByBarcode } from "@/lib/shared-medication-catalog";

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

type MedicationLookup = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  inventoryUnit?: string;
};

type OnHandResponse = {
  medication: {
    id: string;
    name: string;
    strength?: string | null;
    dosageForm?: string | null;
    manufacturer?: string | null;
    barcode?: string | null;
    deaSchedule?: string | null;
    inventoryUnit?: string | null;
  };
  location: LocationOption;
  onHand: number;
  inventoryUnit: string;
};

export default function TransferPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const [lookup, setLookup] = useState<OnHandResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const matchedMedication = useMemo<MedicationLookup | undefined>(() => {
    if (!barcode.trim()) return undefined;

    const result = findMedicationByBarcode(barcode.trim());
    if (!result) return undefined;

    return {
      barcode: result.barcode,
      medicationName:
        (result as any).medicationName ||
        (result as any).name ||
        "Unknown medication",
      strength: (result as any).strength || "",
      dosageForm: (result as any).dosageForm || "",
      manufacturer: (result as any).manufacturer || "",
      ndc: (result as any).ndc || "",
      deaSchedule: (result as any).deaSchedule || "",
      inventoryUnit: (result as any).inventoryUnit || "",
    };
  }, [barcode]);

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        setIsLoadingLocations(true);

        const res = await fetch("/api/locations", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load locations");
        }

        const nextLocations: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;

        setLocations(nextLocations);

        if (nextLocations.length > 0) {
          setFromLocationId((current) => current || nextLocations[0].id);
        }

        if (nextLocations.length > 1) {
          setToLocationId((current) => {
            if (current && nextLocations.some((loc) => loc.id === current)) {
              return current;
            }
            return nextLocations[1].id;
          });
        }
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load locations"
        );
      } finally {
        if (isMounted) {
          setIsLoadingLocations(false);
        }
      }
    }

    loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  const availableDestinationLocations = useMemo(() => {
    return locations.filter((location) => location.id !== fromLocationId);
  }, [locations, fromLocationId]);

  useEffect(() => {
    if (!availableDestinationLocations.find((loc) => loc.id === toLocationId)) {
      setToLocationId(availableDestinationLocations[0]?.id || "");
    }
  }, [availableDestinationLocations, toLocationId]);

  useEffect(() => {
    setLookup(null);
    setSuccessMessage("");
    setErrorMessage("");
  }, [fromLocationId]);

  async function handleLookup() {
    if (!barcode.trim()) {
      setErrorMessage("Scan or enter a barcode first.");
      setLookup(null);
      return;
    }

    if (!matchedMedication) {
      setErrorMessage("Medication barcode not found.");
      setLookup(null);
      return;
    }

    if (!fromLocationId) {
      setErrorMessage("Select a source location first.");
      setLookup(null);
      return;
    }

    setLookupLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch(
        `/api/inventory/on-hand?barcode=${encodeURIComponent(
          matchedMedication.barcode
        )}&locationId=${encodeURIComponent(fromLocationId)}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setLookup(null);
        setErrorMessage(data?.error || "Failed to load inventory");
        return;
      }

      setLookup(data);
    } catch (error) {
      console.error(error);
      setLookup(null);
      setErrorMessage("Failed to load inventory");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!matchedMedication) {
      setErrorMessage("Scan or enter a valid medication barcode first.");
      return;
    }

    if (!lookup) {
      setErrorMessage("Lookup inventory before saving transfer.");
      return;
    }

    if (!fromLocationId || !toLocationId) {
      setErrorMessage("Select both source and destination locations.");
      return;
    }

    if (fromLocationId === toLocationId) {
      setErrorMessage("Source and destination locations must be different.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setErrorMessage("Enter a valid transfer quantity.");
      return;
    }

    if (numericQuantity > lookup.onHand) {
      setErrorMessage("Transfer quantity exceeds available on-hand inventory.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barcode: matchedMedication.barcode,
          fromLocationId,
          toLocationId,
          quantity: numericQuantity,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error || "Failed to transfer inventory");
        return;
      }

      setSuccessMessage("Transfer saved successfully.");
      setQuantity("");
      setNote("");
      await handleLookup();

      setTimeout(() => {
        router.push("/reports/transactions");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to transfer inventory");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit =
    !!lookup &&
    !!matchedMedication &&
    !!fromLocationId &&
    !!toLocationId &&
    fromLocationId !== toLocationId &&
    !!quantity &&
    !saving &&
    !isLoadingLocations;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Transfer Inventory
        </h1>
        <p className="mt-2 text-slate-600">
          Move inventory between active locations using live on-hand quantity.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                From Location
              </label>
              <select
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                disabled={isLoadingLocations}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingLocations
                    ? "Loading locations..."
                    : "Select source location"}
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
                To Location
              </label>
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                disabled={isLoadingLocations}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingLocations
                    ? "Loading locations..."
                    : "Select destination location"}
                </option>
                {availableDestinationLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` (${location.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Barcode
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setLookup(null);
                    setSuccessMessage("");
                    setErrorMessage("");
                  }}
                  placeholder="Scan barcode"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={lookupLoading || isLoadingLocations}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookupLoading ? "Loading..." : "Lookup"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Medication</p>
              <p className="font-medium text-slate-900">
                {lookup?.medication?.name ||
                  matchedMedication?.medicationName ||
                  "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Strength / Form</p>
              <p className="font-medium text-slate-900">
                {lookup?.medication?.strength ||
                  matchedMedication?.strength ||
                  "-"}{" "}
                /{" "}
                {lookup?.medication?.dosageForm ||
                  matchedMedication?.dosageForm ||
                  "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">DEA Schedule</p>
              <p className="font-medium text-slate-900">
                {lookup?.medication?.deaSchedule ||
                  matchedMedication?.deaSchedule ||
                  "Non-controlled"}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Available On-Hand</p>
              <p className="font-medium text-slate-900">
                {lookup ? `${lookup.onHand} ${lookup.inventoryUnit ?? ""}` : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Quantity to Transfer
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Inventory Unit
              </label>
              <input
                type="text"
                value={
                  lookup?.inventoryUnit ||
                  matchedMedication?.inventoryUnit ||
                  ""
                }
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Note
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                placeholder="Optional transfer note"
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Transfer"}
          </button>
        </form>
      </div>
    </div>
  );
}
