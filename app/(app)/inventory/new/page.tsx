"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeaSchedule = "NONE" | "C2" | "C3" | "C4" | "C5";
type InventoryUnit =
  | "EACH"
  | "ML"
  | "TABLET"
  | "CAPSULE"
  | "VIAL"
  | "AMPULE"
  | "TUBE"
  | "BOTTLE"
  | "PATCH"
  | "SYRINGE"
  | "KIT"
  | "GRAM";

const DEA_SCHEDULE_OPTIONS: DeaSchedule[] = ["NONE", "C2", "C3", "C4", "C5"];

const INVENTORY_UNIT_OPTIONS: InventoryUnit[] = [
  "EACH",
  "ML",
  "TABLET",
  "CAPSULE",
  "VIAL",
  "AMPULE",
  "TUBE",
  "BOTTLE",
  "PATCH",
  "SYRINGE",
  "KIT",
  "GRAM",
];

function inferInventoryUnit(dosageForm: string): InventoryUnit {
  const normalized = dosageForm.trim().toLowerCase();

  if (
    normalized.includes("injection") ||
    normalized.includes("solution") ||
    normalized.includes("liquid") ||
    normalized.includes("ophthalmic") ||
    normalized.includes("drops")
  ) {
    return "ML";
  }

  if (normalized.includes("tablet")) return "TABLET";
  if (normalized.includes("capsule")) return "CAPSULE";
  if (normalized.includes("vial")) return "VIAL";
  if (normalized.includes("ampule") || normalized.includes("ampoule")) return "AMPULE";
  if (normalized.includes("tube") || normalized.includes("cream") || normalized.includes("ointment") || normalized.includes("gel")) {
    return "TUBE";
  }
  if (normalized.includes("bottle")) return "BOTTLE";
  if (normalized.includes("patch")) return "PATCH";
  if (normalized.includes("syringe")) return "SYRINGE";
  if (normalized.includes("kit")) return "KIT";
  if (normalized.includes("powder")) return "GRAM";

  return "EACH";
}

function inferMultiDose(category: string, dosageForm: string) {
  const categoryNormalized = category.trim().toLowerCase();
  const dosageFormNormalized = dosageForm.trim().toLowerCase();

  if (
    categoryNormalized.includes("controlled") ||
    dosageFormNormalized.includes("vial") ||
    dosageFormNormalized.includes("drops") ||
    dosageFormNormalized.includes("cream") ||
    dosageFormNormalized.includes("ointment") ||
    dosageFormNormalized.includes("gel") ||
    dosageFormNormalized.includes("bottle")
  ) {
    return true;
  }

  return false;
}

function inferOpenedUsePolicy(isMultiDose: boolean, dosageForm: string) {
  if (!isMultiDose) return "SINGLE_USE";

  const normalized = dosageForm.trim().toLowerCase();

  if (
    normalized.includes("drops") ||
    normalized.includes("cream") ||
    normalized.includes("ointment") ||
    normalized.includes("gel") ||
    normalized.includes("powder")
  ) {
    return "UNTIL_MANUFACTURER_EXP";
  }

  return "DAYS_AFTER_OPEN";
}

export default function NewMedicationPage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [ndc, setNdc] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [deaSchedule, setDeaSchedule] = useState<DeaSchedule>("NONE");
  const [inventoryUnit, setInventoryUnit] = useState<InventoryUnit>("EACH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!barcode.trim() || !medicationName.trim() || !strength.trim() || !dosageForm.trim()) {
      setErrorMessage(
        "Please complete barcode, medication name, strength, and dosage form."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const trimmedCategory = category.trim();
      const inferredIsMultiDose = inferMultiDose(trimmedCategory, dosageForm);
      const openedUsePolicy = inferOpenedUsePolicy(inferredIsMultiDose, dosageForm);

      const response = await fetch("/api/medications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: medicationName.trim(),
          genericName: "",
          strength: strength.trim(),
          dosageForm: dosageForm.trim(),
          manufacturer: manufacturer.trim(),
          ndc: ndc.trim(),
          barcode: barcode.trim(),
          deaSchedule: deaSchedule === "NONE" ? "" : deaSchedule,
          inventoryUnit,
          isControlled: deaSchedule !== "NONE",
          isActive: true,
          isMultiDose: inferredIsMultiDose,
          openedUsePolicy,
          openedUseDays: openedUsePolicy === "DAYS_AFTER_OPEN" ? 28 : null,
          requiresOpenedDate: openedUsePolicy === "DAYS_AFTER_OPEN",
          requiresWitnessWaste: deaSchedule !== "NONE",
          notes: notes.trim() || trimmedCategory || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save medication.");
      }

      router.push("/admin/medications");
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save medication."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">
          Add Medication
        </h1>
        <p className="mt-2 text-slate-600">
          Create a medication in the live medication master so it is available to
          inventory workflows, barcode lookup, and dispensing.
        </p>
      </div>

      <div className="max-w-4xl rounded-xl border bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Barcode
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or enter manufacturer barcode"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Medication Name
              </label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder="Morphine Sulfate"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Strength
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="2 mg/mL"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Dosage Form
              </label>
              <input
                type="text"
                value={dosageForm}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setDosageForm(nextValue);
                  setInventoryUnit(inferInventoryUnit(nextValue));
                }}
                placeholder="Injection"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Manufacturer
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Pfizer"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                NDC / Medication Code
              </label>
              <input
                type="text"
                value={ndc}
                onChange={(e) => setNdc(e.target.value)}
                placeholder="12345-6789-01"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select category</option>
                <option value="Analgesic">Analgesic</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Antiemetic">Antiemetic</option>
                <option value="Insulin">Insulin</option>
                <option value="Controlled Substance">Controlled Substance</option>
                <option value="Sedative">Sedative</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                DEA Schedule
              </label>
              <select
                value={deaSchedule}
                onChange={(e) => setDeaSchedule(e.target.value as DeaSchedule)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {DEA_SCHEDULE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "NONE" ? "Not Controlled" : option}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Controlled medications should be assigned C2, C3, C4, or C5.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Inventory Unit
              </label>
              <select
                value={inventoryUnit}
                onChange={(e) => setInventoryUnit(e.target.value as InventoryUnit)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {INVENTORY_UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 px-4 py-4">
            <p className="text-sm font-medium text-slate-700">
              Controlled medication status
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {deaSchedule === "NONE"
                ? "This medication will be treated as non-controlled."
                : `This medication will be treated as ${deaSchedule} and included in controlled medication reconciliation filters.`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description / Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about storage, handling, or medication details"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex gap-3">
            <Link
              href="/inventory"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save Medication"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
