"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activateMedicationMasterRecord,
  deactivateMedicationMasterRecord,
  deleteMedicationMasterRecord,
  exportMedicationMasterJson,
  getMedicationMasterRecords,
  importMedicationMasterJson,
  type MedicationMasterRecord,
  type OpenedUsePolicy,
  upsertMedicationMasterRecord,
} from "@/lib/medication-master-admin";
import { getCurrentUser } from "@/lib/mock-session";
import { canManageMedicationMaster } from "@/lib/rbac";

type FormState = {
  id?: string;
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  deaSchedule: string;
  medicationCategory: string;
  inventoryUnit: string;
  isMultidose: boolean;
  openedUsePolicy: OpenedUsePolicy;
  openedUseDays: string;
  requiresOpenedDate: boolean;
  requiresContainerTracking: boolean;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: undefined,
  barcode: "",
  medicationName: "",
  strength: "",
  dosageForm: "",
  manufacturer: "",
  ndc: "",
  deaSchedule: "",
  medicationCategory: "",
  inventoryUnit: "",
  isMultidose: false,
  openedUsePolicy: "SINGLE_USE",
  openedUseDays: "",
  requiresOpenedDate: false,
  requiresContainerTracking: false,
  status: "ACTIVE",
  notes: "",
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function mapRecordToForm(record: MedicationMasterRecord): FormState {
  return {
    id: record.id,
    barcode: record.barcode,
    medicationName: record.medicationName,
    strength: record.strength,
    dosageForm: record.dosageForm,
    manufacturer: record.manufacturer,
    ndc: record.ndc,
    deaSchedule: record.deaSchedule ?? "",
    medicationCategory: record.medicationCategory,
    inventoryUnit: record.inventoryUnit,
    isMultidose: record.isMultidose,
    openedUsePolicy: record.openedUsePolicy,
    openedUseDays:
      record.openedUseDays === null || record.openedUseDays === undefined
        ? ""
        : String(record.openedUseDays),
    requiresOpenedDate: record.requiresOpenedDate,
    requiresContainerTracking: record.requiresContainerTracking,
    status: record.status,
    notes: record.notes,
  };
}

export default function MedicationMasterPage() {
  const currentUser = getCurrentUser();
  const canManage = canManageMedicationMaster(currentUser);

  const [records, setRecords] = useState<MedicationMasterRecord[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ACTIVE"
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    setRecords(getMedicationMasterRecords());
  }, []);

  useEffect(() => {
    if (!form.isMultidose) {
      setForm((current) => ({
        ...current,
        openedUsePolicy: "SINGLE_USE",
        openedUseDays: "",
        requiresOpenedDate: false,
        requiresContainerTracking: false,
      }));
      return;
    }

    if (form.isMultidose && form.openedUsePolicy === "SINGLE_USE") {
      setForm((current) => ({
        ...current,
        openedUsePolicy: "UNTIL_MANUFACTURER_EXP",
      }));
    }
  }, [form.isMultidose, form.openedUsePolicy]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : record.status === statusFilter;

      if (!matchesStatus) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        record.id,
        record.barcode,
        record.medicationName,
        record.strength,
        record.dosageForm,
        record.manufacturer,
        record.ndc,
        record.deaSchedule,
        record.medicationCategory,
        record.inventoryUnit,
        record.notes,
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [records, query, statusFilter]);

  function refresh(next?: MedicationMasterRecord[]) {
    setRecords(next ?? getMedicationMasterRecords());
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");
  }

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to manage Medication Master.");
      return;
    }

    try {
      const next = upsertMedicationMasterRecord({
        id: form.id,
        barcode: form.barcode,
        medicationName: form.medicationName,
        strength: form.strength,
        dosageForm: form.dosageForm,
        manufacturer: form.manufacturer,
        ndc: form.ndc,
        deaSchedule: form.deaSchedule,
        medicationCategory: form.medicationCategory,
        inventoryUnit: form.inventoryUnit,
        isMultidose: form.isMultidose,
        openedUsePolicy: form.openedUsePolicy,
        openedUseDays:
          form.openedUsePolicy === "DAYS_AFTER_OPEN" ? form.openedUseDays : null,
        requiresOpenedDate: form.requiresOpenedDate,
        requiresContainerTracking: form.requiresContainerTracking,
        status: form.status,
        notes: form.notes,
      });

      refresh(next);
      setForm(EMPTY_FORM);
      setMessage(form.id ? "Medication updated." : "Medication created.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save medication record."
      );
    }
  }

  function handleEdit(record: MedicationMasterRecord) {
    setMessage("");
    setError("");
    setForm(mapRecordToForm(record));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDeactivate(id: string) {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to manage Medication Master.");
      return;
    }

    try {
      const next = deactivateMedicationMasterRecord(id);
      refresh(next);
      if (form.id === id) {
        setForm(EMPTY_FORM);
      }
      setMessage("Medication deactivated.");
    } catch {
      setError("Unable to deactivate medication.");
    }
  }

  function handleActivate(id: string) {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to manage Medication Master.");
      return;
    }

    try {
      const next = activateMedicationMasterRecord(id);
      refresh(next);
      setMessage("Medication activated.");
    } catch {
      setError("Unable to activate medication.");
    }
  }

  function handleDelete(id: string) {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to manage Medication Master.");
      return;
    }

    try {
      const next = deleteMedicationMasterRecord(id);
      refresh(next);
      if (form.id === id) {
        setForm(EMPTY_FORM);
      }
      setMessage("Medication deleted.");
    } catch {
      setError("Unable to delete medication.");
    }
  }

  async function handleExport() {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to export Medication Master.");
      return;
    }

    try {
      const json = exportMedicationMasterJson();
      await navigator.clipboard.writeText(json);
      setMessage("Medication Master JSON copied to clipboard.");
    } catch {
      setError("Unable to export Medication Master JSON.");
    }
  }

  function handleImport() {
    setMessage("");
    setError("");

    if (!canManage) {
      setError("You do not have permission to import Medication Master.");
      return;
    }

    try {
      const next = importMedicationMasterJson(importText);
      refresh(next);
      setImportText("");
      setShowImportBox(false);
      setMessage("Medication Master imported.");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import Medication Master JSON."
      );
    }
  }

  const activeCount = records.filter((item) => item.status === "ACTIVE").length;
  const inactiveCount = records.filter(
    (item) => item.status === "INACTIVE"
  ).length;
  const controlledCount = records.filter((item) =>
    ["C2", "C3", "C4", "C5"].includes(item.deaSchedule ?? "")
  ).length;

  return (
    <div className="space-y-6">
      {!canManage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have view access only. Your current role can review Medication
          Master records but cannot create, edit, import, export, activate,
          deactivate, or delete them.
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Medication Master / Barcode Mapping
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Central medication catalog for barcode mapping, NDC, DEA schedule,
          dosage form, multidose behavior, BUD/opened-use defaults, and
          container tracking.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total records</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {records.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Inactive</p>
            <p className="mt-1 text-2xl font-semibold text-slate-600">
              {inactiveCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Controlled</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {controlledCount}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={!canManage}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => setShowImportBox((current) => !current)}
            disabled={!canManage}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showImportBox ? "Hide Import" : "Import JSON"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {showImportBox ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Import JSON</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste a JSON array of medication records. This replaces the current
            Medication Master dataset stored in the browser for now.
          </p>

          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={10}
            disabled={!canManage}
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
            placeholder='[{"barcode":"0123456789012","medicationName":"Lidocaine"}]'
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!canManage}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import records
            </button>
            <button
              type="button"
              onClick={() => {
                setImportText("");
                setShowImportBox(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? "Edit medication" : "Add medication"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Define barcode mapping and medication defaults.
              </p>
            </div>

            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Barcode</span>
              <input
                value={form.barcode}
                onChange={(event) => handleChange("barcode", event.target.value)}
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Scan or enter manufacturer barcode"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Medication name
              </span>
              <input
                value={form.medicationName}
                onChange={(event) =>
                  handleChange("medicationName", event.target.value)
                }
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Medication name"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Strength</span>
              <input
                value={form.strength}
                onChange={(event) => handleChange("strength", event.target.value)}
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Ex. 1%"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Dosage form
              </span>
              <input
                value={form.dosageForm}
                onChange={(event) => handleChange("dosageForm", event.target.value)}
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Ex. Injection, cream, eye drops"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Manufacturer
              </span>
              <input
                value={form.manufacturer}
                onChange={(event) =>
                  handleChange("manufacturer", event.target.value)
                }
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Manufacturer"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">NDC</span>
              <input
                value={form.ndc}
                onChange={(event) => handleChange("ndc", event.target.value)}
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Ex. 0409-4276-02"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                DEA schedule
              </span>
              <select
                value={form.deaSchedule}
                onChange={(event) => handleChange("deaSchedule", event.target.value)}
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
              >
                <option value="">Not controlled</option>
                <option value="C2">C2</option>
                <option value="C3">C3</option>
                <option value="C4">C4</option>
                <option value="C5">C5</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Category
              </span>
              <input
                value={form.medicationCategory}
                onChange={(event) =>
                  handleChange("medicationCategory", event.target.value)
                }
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Ex. VIAL, EYE_DROPS, TOPICAL_CREAM"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Inventory unit
              </span>
              <input
                value={form.inventoryUnit}
                onChange={(event) =>
                  handleChange("inventoryUnit", event.target.value)
                }
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                placeholder="Ex. mL, vial, bottle, tube"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  handleChange(
                    "status",
                    event.target.value as "ACTIVE" | "INACTIVE"
                  )
                }
                disabled={!canManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Opened container behavior
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isMultidose}
                  onChange={(event) =>
                    handleChange("isMultidose", event.target.checked)
                  }
                  disabled={!canManage}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Multidose / reusable after opening
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.requiresContainerTracking}
                  onChange={(event) =>
                    handleChange("requiresContainerTracking", event.target.checked)
                  }
                  disabled={!canManage || !form.isMultidose}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Track opened container identity
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.requiresOpenedDate}
                  onChange={(event) =>
                    handleChange("requiresOpenedDate", event.target.checked)
                  }
                  disabled={!canManage || !form.isMultidose}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Require opened / puncture date
                </span>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">
                  Opened use policy
                </span>
                <select
                  value={form.openedUsePolicy}
                  onChange={(event) =>
                    handleChange(
                      "openedUsePolicy",
                      event.target.value as OpenedUsePolicy
                    )
                  }
                  disabled={!canManage || !form.isMultidose}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                >
                  <option value="SINGLE_USE">Single use</option>
                  <option value="UNTIL_MANUFACTURER_EXP">
                    Use until manufacturer expiration
                  </option>
                  <option value="DAYS_AFTER_OPEN">Days after open</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Opened use days
                </span>
                <input
                  value={form.openedUseDays}
                  onChange={(event) =>
                    handleChange("openedUseDays", event.target.value)
                  }
                  disabled={
                    !canManage ||
                    !form.isMultidose ||
                    form.openedUsePolicy !== "DAYS_AFTER_OPEN"
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="Ex. 28"
                />
              </label>
            </div>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => handleChange("notes", event.target.value)}
              rows={4}
              disabled={!canManage}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
              placeholder="Optional notes"
            />
          </label>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canManage}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {form.id ? "Save changes" : "Create medication"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Medication records
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Search and manage saved Medication Master records.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Search medication, barcode, NDC..."
              />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "ALL" | "ACTIVE" | "INACTIVE"
                  )
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive only</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No Medication Master records found.
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">
                          {record.medicationName}
                          {record.strength ? ` ${record.strength}` : ""}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            record.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {record.status}
                        </span>

                        {record.deaSchedule ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {record.deaSchedule}
                          </span>
                        ) : null}

                        {record.isMultidose ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            Multidose
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Single use
                          </span>
                        )}
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>
                          <span className="font-medium text-slate-700">ID:</span>{" "}
                          {record.id}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Barcode:
                          </span>{" "}
                          {record.barcode || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">NDC:</span>{" "}
                          {record.ndc || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Dosage form:
                          </span>{" "}
                          {record.dosageForm || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Manufacturer:
                          </span>{" "}
                          {record.manufacturer || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Category:
                          </span>{" "}
                          {record.medicationCategory || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Inventory unit:
                          </span>{" "}
                          {record.inventoryUnit || "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Opened policy:
                          </span>{" "}
                          {record.openedUsePolicy}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Opened days:
                          </span>{" "}
                          {record.openedUseDays ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Requires opened date:
                          </span>{" "}
                          {record.requiresOpenedDate ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">
                            Track container:
                          </span>{" "}
                          {record.requiresContainerTracking ? "Yes" : "No"}
                        </p>
                      </div>

                      {record.notes ? (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Notes:</span>{" "}
                          {record.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(record)}
                        disabled={!canManage}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>

                      {record.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(record.id)}
                          disabled={!canManage}
                          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivate(record.id)}
                          disabled={!canManage}
                          className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
                        disabled={!canManage}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
