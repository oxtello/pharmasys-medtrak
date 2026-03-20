"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CURRENT_USER } from "@/lib/mock-session";
import { findMedicationByBarcode } from "@/lib/shared-medication-catalog";
import {
  getMostRecentActiveOpenedContainer,
  openContainerAndPrintLabel,
} from "@/lib/open-container-workflow";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatPolicy(
  policy?: string,
  days?: number | null,
  expirationDate?: string | null
) {
  if (policy === "DAYS_AFTER_OPEN" && days) return `${days} days after opening`;
  if (policy === "SINGLE_USE") return "Single use";
  if (policy === "UNTIL_MANUFACTURER_EXP") {
    return expirationDate
      ? "Use until manufacturer expiration"
      : "Use until manufacturer expiration";
  }
  return "Use until manufacturer expiration";
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function OpenContainerPage() {
const [barcode, setBarcode] = useState("");
const [location, setLocation] = useState("Main Campus");
  const [openedDate, setOpenedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [initialQuantity, setInitialQuantity] = useState("");
  const [unit, setUnit] = useState("mL");
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCreatedId, setLastCreatedId] = useState("");

  const medication = useMemo(() => {
    return barcode ? findMedicationByBarcode(barcode) : undefined;
  }, [barcode]);

  const existingActive = useMemo(() => {
    if (!barcode || !location) return null;
    return getMostRecentActiveOpenedContainer(barcode, location);
  }, [barcode, location, lastCreatedId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedMessage("");
    setErrorMessage("");

    if (!barcode.trim()) {
      setErrorMessage("Scan or enter a barcode.");
      return;
    }

    if (!medication) {
      setErrorMessage("Barcode not found in shared medication catalog.");
      return;
    }

    if (!openedDate) {
      setErrorMessage("Opened date is required.");
      return;
    }

    const qty = toNumber(initialQuantity);
    if (qty <= 0) {
      setErrorMessage("Enter a valid opening quantity.");
      return;
    }

    try {
      const result = openContainerAndPrintLabel({
        barcode,
        sourceLocation: location,
        openedDate,
        initialQuantity: qty,
        unit,
        lotNumber,
        expirationDate,
	openedBy: "Current User",
        notes,
      });

      setLastCreatedId(result.record.containerId);

      if (result.existedAlready) {
        setSavedMessage(
          `Active container already exists. Label downloaded for ${result.record.containerId}.`
        );
      } else {
        setSavedMessage(
          `Opened container created and label downloaded: ${result.record.containerId}`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to open container."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-700">Inventory</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Open Container
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create an opened-container record, calculate BUD, and download the vial label.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Barcode
              </span>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan manufacturer barcode"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Location
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Opened Date
              </span>
              <input
                type="date"
                value={openedDate}
                onChange={(e) => setOpenedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Opening Quantity
              </span>
              <input
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                placeholder="30"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Unit
              </span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mL"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Lot Number
              </span>
              <input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Manufacturer Expiration
              </span>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Notes
              </span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {savedMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {savedMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-[color:var(--brand-blue)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              Open Container + Print Label
            </button>

            <Link
              href="/inventory"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Medication details
            </h2>

            {!medication ? (
              <p className="mt-4 text-sm text-slate-500">
                Scan a barcode to load medication details.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InfoCard label="Medication" value={medication.medicationName} />
                <InfoCard label="Strength" value={medication.strength || "-"} />
                <InfoCard label="Dosage form" value={medication.dosageForm || "-"} />
                <InfoCard
                  label="DEA schedule"
                  value={medication.deaSchedule || "-"}
                />
                <InfoCard
                  label="Policy"
                  value={formatPolicy(
                    medication.openedUsePolicy,
                    medication.openedUseDays,
                    expirationDate || null
                  )}
                />
                <InfoCard
                  label="Tracking"
                  value={
                    medication.requiresContainerTracking ? "Required" : "Not required"
                  }
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Existing active container
            </h2>

            {!existingActive ? (
              <p className="mt-4 text-sm text-slate-500">
                No active container loaded.
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Active container already exists</p>
                <p className="mt-2">Container ID: {existingActive.containerId}</p>
                <p>
                  Remaining: {existingActive.remainingQuantity}{" "}
                  {existingActive.unit || ""}
                </p>
                <p>
                  BUD:{" "}
                  {existingActive.discardAfterOpenDate ||
                    existingActive.expirationDate ||
                    existingActive.openedDate}
                </p>
              </div>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {value || "-"}
      </div>
    </div>
  );
}
