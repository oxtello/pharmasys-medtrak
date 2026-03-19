"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { findMedicationByBarcode } from "@/lib/shared-medication-catalog";

type MedicationMatch = {
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  inventoryUnit?: string;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string;
};

const REASONS = [
  "Count correction",
  "Damaged stock correction",
  "Expired stock correction",
  "Documentation correction",
  "Other",
] as const;

export default function AdjustPage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [locationId, setLocationId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"ADD" | "SUBTRACT">(
    "SUBTRACT"
  );
  const [quantity, setQuantity] = useState("");
  const [reasonCode, setReasonCode] = useState<string>(REASONS[0]);
  const [note, setNote] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const matchedMedication = useMemo<MedicationMatch | undefined>(() => {
    if (!barcode.trim()) return undefined;

    const result = findMedicationByBarcode(barcode.trim());
    if (!result) return undefined;

    return {
      barcode: result.barcode,
      medicationName:
        (result as { medicationName?: string; name?: string }).medicationName ||
        (result as { medicationName?: string; name?: string }).name ||
        "Unknown medication",
      strength: (result as { strength?: string }).strength || "",
      dosageForm: (result as { dosageForm?: string }).dosageForm || "",
      manufacturer: (result as { manufacturer?: string }).manufacturer || "",
      ndc: (result as { ndc?: string }).ndc || "",
      deaSchedule: (result as { deaSchedule?: string }).deaSchedule || "",
      inventoryUnit: (result as { inventoryUnit?: string }).inventoryUnit || "",
    };
  }, [barcode]);

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        setIsLoadingLocations(true);
        setErrorMessage("");

        const response = await fetch("/api/locations", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load locations");
        }

        const data = await response.json();

        const resolvedLocations: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;

        setLocations(resolvedLocations);

        if (resolvedLocations.length > 0) {
          setLocationId((current) => current || resolvedLocations[0].id);
        }
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setErrorMessage("Unable to load locations.");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!matchedMedication) {
      setErrorMessage("Scan or enter a valid medication barcode first.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Select a location.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setErrorMessage("Quantity must be greater than 0.");
      return;
    }

    if (!reasonCode.trim()) {
      setErrorMessage("Reason is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barcode: matchedMedication.barcode,
          locationId,
          adjustmentType,
          quantity: numericQuantity,
          reasonCode,
          note: note.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Adjust transaction failed");
      }

      setSuccessMessage("Adjustment saved to database.");
      setBarcode("");
      setQuantity("");
      setNote("");
      setReasonCode(REASONS[0]);
      setAdjustmentType("SUBTRACT");

      setTimeout(() => {
        router.push("/inventory");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Adjust transaction failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900">Adjust</h1>
          <p className="mt-2 text-sm text-slate-500">
            Record a supervised inventory correction in the database ledger.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="barcode"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Barcode
              </label>
              <input
                id="barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan manufacturer barcode"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
            </div>

            <ReadOnlyField
              label="Medication"
              value={matchedMedication?.medicationName || ""}
            />
            <ReadOnlyField
              label="Strength"
              value={matchedMedication?.strength || ""}
            />
            <ReadOnlyField
              label="Dosage Form"
              value={matchedMedication?.dosageForm || ""}
            />
            <ReadOnlyField
              label="Manufacturer"
              value={matchedMedication?.manufacturer || ""}
            />
            <ReadOnlyField label="NDC" value={matchedMedication?.ndc || ""} />
            <ReadOnlyField
              label="DEA Schedule"
              value={matchedMedication?.deaSchedule || "Non-controlled"}
            />

            <div>
              <label
                htmlFor="locationId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Location
              </label>
              <select
                id="locationId"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                disabled={isLoadingLocations}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingLocations ? "Loading locations..." : "Select location"}
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
              <label
                htmlFor="adjustmentType"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Adjustment Type
              </label>
              <select
                id="adjustmentType"
                value={adjustmentType}
                onChange={(event) =>
                  setAdjustmentType(event.target.value as "ADD" | "SUBTRACT")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="SUBTRACT">Subtract inventory</option>
                <option value="ADD">Add inventory</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={
                  matchedMedication?.inventoryUnit
                    ? `Enter quantity in ${matchedMedication.inventoryUnit}`
                    : "Enter quantity"
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="reasonCode"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Reason
              </label>
              <select
                id="reasonCode"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="note"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Note
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Optional adjustment note"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingLocations}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Saving..." : "Save Adjustment"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}
