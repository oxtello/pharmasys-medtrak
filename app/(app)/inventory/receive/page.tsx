"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MedicationMatch = {
  id: string;
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  inventoryUnit?: string;
  isActive?: boolean;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string;
};

export default function ReceivePage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [matchedMedication, setMatchedMedication] = useState<
    MedicationMatch | undefined
  >(undefined);
  const [isLookingUpMedication, setIsLookingUpMedication] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        setIsLoadingLocations(true);

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

  useEffect(() => {
    let isMounted = true;

    async function lookupMedication() {
      const trimmedBarcode = barcode.trim();

      if (!trimmedBarcode) {
        setMatchedMedication(undefined);
        return;
      }

      try {
        setIsLookingUpMedication(true);

        const response = await fetch(
          `/api/medications/by-barcode?barcode=${encodeURIComponent(
            trimmedBarcode
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (!response.ok) {
          setMatchedMedication(undefined);
          return;
        }

        const medication = data?.medication;

        if (!medication) {
          setMatchedMedication(undefined);
          return;
        }

        setMatchedMedication({
          id: medication.id,
          barcode: medication.barcode || trimmedBarcode,
          medicationName: medication.name || "Unknown medication",
          strength: medication.strength || "",
          dosageForm: medication.dosageForm || "",
          manufacturer: medication.manufacturer || "",
          ndc: medication.ndc || "",
          deaSchedule: medication.deaSchedule || "",
          inventoryUnit: medication.inventoryUnit || "",
          isActive: medication.isActive,
        });
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setMatchedMedication(undefined);
      } finally {
        if (isMounted) {
          setIsLookingUpMedication(false);
        }
      }
    }

    lookupMedication();

    return () => {
      isMounted = false;
    };
  }, [barcode]);

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

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/inventory/receive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barcode: matchedMedication.barcode,
          lotNumber: lotNumber.trim() || null,
          expirationDate: expirationDate || null,
          quantity: numericQuantity,
          locationId,
          note: note.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Receive transaction failed");
      }

      setSuccessMessage("Receive record saved to database.");
      setBarcode("");
      setLotNumber("");
      setExpirationDate("");
      setQuantity("");
      setNote("");
      setMatchedMedication(undefined);

      setTimeout(() => {
        router.push("/inventory");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Receive transaction failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900">
            Receive Stock
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Scan a medication barcode, confirm lot and expiration details, and
            save the receipt directly to the database ledger.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Medication must exist in the live medication master before it can be
            received.
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
              {isLookingUpMedication ? (
                <p className="mt-2 text-xs text-slate-500">
                  Looking up medication...
                </p>
              ) : null}
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
                htmlFor="lotNumber"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Lot Number
              </label>
              <input
                id="lotNumber"
                value={lotNumber}
                onChange={(event) => setLotNumber(event.target.value)}
                placeholder="Enter lot number"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="expirationDate"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Expiration Date
              </label>
              <input
                id="expirationDate"
                type="date"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Quantity Received
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
                placeholder="Optional receiving note"
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
              disabled={isSubmitting || isLoadingLocations || isLookingUpMedication}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Saving..." : "Save Receive Record"}
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
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}
