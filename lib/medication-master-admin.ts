export const MEDICATION_MASTER_STORAGE_KEY = "medtrak-medication-master";

export type OpenedUsePolicy =
  | "UNTIL_MANUFACTURER_EXP"
  | "DAYS_AFTER_OPEN"
  | "SINGLE_USE";

export type MedicationMasterStatus = "ACTIVE" | "INACTIVE";

export type MedicationMasterRecord = {
  id: string;
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  deaSchedule?: string;
  medicationCategory: string;
  inventoryUnit: string;
  isMultidose: boolean;
  openedUsePolicy: OpenedUsePolicy;
  openedUseDays: number | null;
  requiresOpenedDate: boolean;
  requiresContainerTracking: boolean;
  status: MedicationMasterStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMedicationMasterInput = {
  id?: string;
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  medicationCategory?: string;
  inventoryUnit?: string;
  isMultidose?: boolean;
  openedUsePolicy?: OpenedUsePolicy;
  openedUseDays?: number | string | null;
  requiresOpenedDate?: boolean;
  requiresContainerTracking?: boolean;
  status?: MedicationMasterStatus;
  notes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function toNumberOrNull(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeDeaSchedule(value: unknown): string {
  const normalized = normalizeUpper(value);

  if (!normalized) return "";

  if (
    normalized === "C2" ||
    normalized === "C3" ||
    normalized === "C4" ||
    normalized === "C5"
  ) {
    return normalized;
  }

  if (
    normalized === "2" ||
    normalized === "II" ||
    normalized === "SCHEDULE II" ||
    normalized === "C-II"
  ) {
    return "C2";
  }

  if (
    normalized === "3" ||
    normalized === "III" ||
    normalized === "SCHEDULE III" ||
    normalized === "C-III"
  ) {
    return "C3";
  }

  if (
    normalized === "4" ||
    normalized === "IV" ||
    normalized === "SCHEDULE IV" ||
    normalized === "C-IV"
  ) {
    return "C4";
  }

  if (
    normalized === "5" ||
    normalized === "V" ||
    normalized === "SCHEDULE V" ||
    normalized === "C-V"
  ) {
    return "C5";
  }

  return "";
}

function generateMedicationMasterId(records: MedicationMasterRecord[]) {
  const maxNumber = records.reduce((maxValue, item) => {
    const match = /^MM-(\d+)$/.exec(normalizeText(item.id));
    if (!match) return maxValue;
    return Math.max(maxValue, Number(match[1]));
  }, 0);

  return `MM-${String(maxNumber + 1).padStart(4, "0")}`;
}

function normalizeOpenedUsePolicy(
  value: unknown,
  isMultidose: boolean
): OpenedUsePolicy {
  if (!isMultidose) return "SINGLE_USE";

  const normalized = normalizeUpper(value);

  if (normalized === "DAYS_AFTER_OPEN") return "DAYS_AFTER_OPEN";
  if (normalized === "SINGLE_USE") return "SINGLE_USE";
  if (normalized === "UNTIL_MANUFACTURER_EXP") return "UNTIL_MANUFACTURER_EXP";

  return "UNTIL_MANUFACTURER_EXP";
}

function normalizeStatus(value: unknown): MedicationMasterStatus {
  return normalizeUpper(value) === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function normalizeMedicationMasterRecord(
  input: Partial<MedicationMasterRecord>,
  existingRecords: MedicationMasterRecord[]
): MedicationMasterRecord {
  const isMultidose = toBoolean(input.isMultidose, false);
  const openedUsePolicy = normalizeOpenedUsePolicy(
    input.openedUsePolicy,
    isMultidose
  );

  const openedUseDays =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toNumberOrNull(input.openedUseDays)
      : null;

  const createdAt = normalizeText(input.createdAt) || nowIso();

  return {
    id: normalizeText(input.id) || generateMedicationMasterId(existingRecords),
    barcode: normalizeText(input.barcode),
    medicationName:
      normalizeText(input.medicationName) || normalizeText((input as any).name),
    strength: normalizeText(input.strength),
    dosageForm: normalizeText(input.dosageForm),
    manufacturer: normalizeText(input.manufacturer),
    ndc: normalizeText(input.ndc),
    deaSchedule: normalizeDeaSchedule(input.deaSchedule) || undefined,
    medicationCategory: normalizeText(input.medicationCategory) || "OTHER",
    inventoryUnit: normalizeText(input.inventoryUnit) || "EACH",
    isMultidose,
    openedUsePolicy,
    openedUseDays,
    requiresOpenedDate:
      openedUsePolicy === "DAYS_AFTER_OPEN"
        ? toBoolean(input.requiresOpenedDate, false)
        : false,
    requiresContainerTracking:
      openedUsePolicy === "DAYS_AFTER_OPEN"
        ? toBoolean(input.requiresContainerTracking, false)
        : false,
    status: normalizeStatus(input.status),
    notes: normalizeText(input.notes),
    createdAt,
    updatedAt: nowIso(),
  };
}

export function safeReadMedicationMaster(): MedicationMasterRecord[] {
  if (!canUseBrowserStorage()) return [];

  try {
    const raw = localStorage.getItem(MEDICATION_MASTER_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<MedicationMasterRecord>[];
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed.map((item, index, arr) =>
      normalizeMedicationMasterRecord(
        item,
        (arr.slice(0, index) as MedicationMasterRecord[]) || []
      )
    );

    return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveMedicationMaster(records: MedicationMasterRecord[]) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(
    MEDICATION_MASTER_STORAGE_KEY,
    JSON.stringify(records, null, 2)
  );
}

export function getMedicationMasterRecords() {
  return safeReadMedicationMaster();
}

export function findMedicationMasterByBarcode(
  barcode: string
): MedicationMasterRecord | null {
  const normalizedBarcode = normalizeText(barcode);
  if (!normalizedBarcode) return null;

  return (
    safeReadMedicationMaster().find(
      (item) =>
        item.status === "ACTIVE" &&
        normalizeText(item.barcode) === normalizedBarcode
    ) || null
  );
}

export function findMedicationMasterById(
  id: string
): MedicationMasterRecord | null {
  const normalizedId = normalizeText(id);
  if (!normalizedId) return null;

  return (
    safeReadMedicationMaster().find(
      (item) => normalizeText(item.id) === normalizedId
    ) || null
  );
}

export function upsertMedicationMasterRecord(
  input: UpsertMedicationMasterInput
): MedicationMasterRecord[] {
  const records = safeReadMedicationMaster();

  const barcode = normalizeText(input.barcode);
  const medicationName = normalizeText(input.medicationName);

  if (!barcode) {
    throw new Error("Barcode is required.");
  }

  if (!medicationName) {
    throw new Error("Medication name is required.");
  }

  const duplicateBarcode = records.find(
    (item) =>
      normalizeText(item.barcode) === barcode &&
      normalizeText(item.id) !== normalizeText(input.id)
  );

  if (duplicateBarcode) {
    throw new Error("That barcode already exists in Medication Master.");
  }

  const existing = records.find(
    (item) => normalizeText(item.id) === normalizeText(input.id)
  );

  const nextRecord = normalizeMedicationMasterRecord(
    {
      ...existing,
      ...input,
      barcode,
      medicationName,
      createdAt: existing?.createdAt ?? nowIso(),
    },
    records
  );

  const nextRecords = existing
    ? records.map((item) => (item.id === existing.id ? nextRecord : item))
    : [nextRecord, ...records];

  saveMedicationMaster(nextRecords);

  return nextRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deactivateMedicationMasterRecord(
  id: string
): MedicationMasterRecord[] {
  const records = safeReadMedicationMaster();

  const nextRecords = records.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "INACTIVE" as const,
          updatedAt: nowIso(),
        }
      : item
  );

  saveMedicationMaster(nextRecords);

  return nextRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function activateMedicationMasterRecord(
  id: string
): MedicationMasterRecord[] {
  const records = safeReadMedicationMaster();

  const nextRecords = records.map((item) =>
    item.id === id
      ? {
          ...item,
          status: "ACTIVE" as const,
          updatedAt: nowIso(),
        }
      : item
  );

  saveMedicationMaster(nextRecords);

  return nextRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteMedicationMasterRecord(
  id: string
): MedicationMasterRecord[] {
  const records = safeReadMedicationMaster();
  const nextRecords = records.filter((item) => item.id !== id);

  saveMedicationMaster(nextRecords);

  return nextRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function exportMedicationMasterJson() {
  return JSON.stringify(safeReadMedicationMaster(), null, 2);
}

export function importMedicationMasterJson(
  text: string
): MedicationMasterRecord[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Import text is not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Import JSON must be an array of medication records.");
  }

  const normalized: MedicationMasterRecord[] = [];
  const seenBarcodes = new Set<string>();

  for (const row of parsed as Partial<MedicationMasterRecord>[]) {
    const normalizedRecord = normalizeMedicationMasterRecord(row, normalized);

    if (!normalizedRecord.barcode) {
      throw new Error("Every imported record must include a barcode.");
    }

    if (!normalizedRecord.medicationName) {
      throw new Error("Every imported record must include a medication name.");
    }

    if (seenBarcodes.has(normalizedRecord.barcode)) {
      throw new Error(
        `Duplicate barcode found in import: ${normalizedRecord.barcode}`
      );
    }

    seenBarcodes.add(normalizedRecord.barcode);
    normalized.push(normalizedRecord);
  }

  saveMedicationMaster(normalized);

  return normalized.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
