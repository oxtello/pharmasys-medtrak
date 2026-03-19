"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type DeaSchedule = "NONE" | "C2" | "C3" | "C4" | "C5";

type MedicationRecord = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  category: string;
  reorderThreshold: string;
  notes: string;
  deaSchedule: DeaSchedule;
  isControlled: boolean;
  createdAt: string;
};

const DEA_SCHEDULE_OPTIONS: DeaSchedule[] = ["NONE", "C2", "C3", "C4", "C5"];

export default function NewMedicationPage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [ndc, setNdc] = useState("");
  const [category, setCategory] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [notes, setNotes] = useState("");
  const [deaSchedule, setDeaSchedule] = useState<DeaSchedule>("NONE");
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!barcode || !medicationName || !strength || !dosageForm) {
      setErrorMessage(
        "Please complete barcode, medication name, strength, and dosage form."
      );
      return;
    }

    const trimmedBarcode = barcode.trim();

    if (!trimmedBarcode) {
      setErrorMessage("Barcode is required.");
      return;
    }

    const existing: MedicationRecord[] = JSON.parse(
      localStorage.getItem("medtrak-medications") || "[]"
    );

    const duplicateBarcode = existing.some(
      (item) => item.barcode.trim() === trimmedBarcode
    );

    if (duplicateBarcode) {
      setErrorMessage("A medication with this barcode already exists.");
      return;
    }

    const medicationRecord: MedicationRecord = {
      barcode: trimmedBarcode,
      medicationName: medicationName.trim(),
      strength: strength.trim(),
      dosageForm: dosageForm.trim(),
      manufacturer: manufacturer.trim(),
      ndc: ndc.trim(),
      category: category.trim(),
      reorderThreshold: reorderThreshold.trim(),
      notes: notes.trim(),
      deaSchedule,
      isControlled: deaSchedule !== "NONE",
      createdAt: new Date().toISOString(),
    };

    const updated = [medicationRecord, ...existing];
    localStorage.setItem("medtrak-medications", JSON.stringify(updated));

    setErrorMessage("");
    router.push("/inventory");
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">
          Add Medication
        </h1>
        <p className="mt-2 text-slate-600">
          Create a new medication record for inventory tracking, receiving, and
          controlled medication reconciliation.
        </p>
      </div>

      <div className="max-w-4xl rounded-xl border bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

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
                onChange={(e) => setDosageForm(e.target.value)}
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
                onChange={(e) =>
                  setDeaSchedule(e.target.value as DeaSchedule)
                }
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
                Reorder Threshold
              </label>
              <input
                type="number"
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                placeholder="10"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save Medication
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
