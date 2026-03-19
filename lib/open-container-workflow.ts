import {
  findMedicationByBarcode,
  normalizeDeaSchedule,
  safeReadJson,
  type SharedMedicationCatalogRecord,
} from "@/lib/shared-medication-catalog";
import {
  buildVialLabelFilename,
  buildVialLabelZpl,
  downloadZplFile,
} from "@/lib/zebra-vial-label";

export const OPENED_CONTAINER_STORAGE_KEY = "medtrak-opened-containers";

export type OpenedContainerStatus = "ACTIVE" | "DEPLETED" | "DISCARDED";

export type OpenedContainerRecord = {
  id: string;
  containerId: string;
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  medicationCategory?: string;
  openedUsePolicy?: string;
  openedUseDays?: number | null;
  requiresOpenedDate: boolean;
  requiresContainerTracking: boolean;
  sourceLocation: string;
  lotNumber?: string;
  expirationDate?: string;
  openedDate: string;
  discardAfterOpenDate?: string | null;
  initialQuantity: number;
  remainingQuantity: number;
  unit?: string;
  openedBy?: string;
  witnessName?: string;
  notes?: string;
  status: OpenedContainerStatus;
  createdAt: string;
  updatedAt: string;
};

export type OpenContainerInput = {
  barcode: string;
  sourceLocation: string;
  openedDate: string;
  initialQuantity: number;
  unit?: string;
  lotNumber?: string;
  expirationDate?: string;
  openedBy?: string;
  witnessName?: string;
  notes?: string;
};

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function generateContainerId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CONT-${stamp}-${random}`;
}

export function getOpenedContainers(): OpenedContainerRecord[] {
  if (!canUseBrowserStorage()) return [];
  return safeReadJson<OpenedContainerRecord[]>(OPENED_CONTAINER_STORAGE_KEY, []);
}

function saveOpenedContainers(records: OpenedContainerRecord[]) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(OPENED_CONTAINER_STORAGE_KEY, JSON.stringify(records));
}

function minIsoDate(a?: string | null, b?: string | null) {
  if (!a && !b) return null;
  if (!a) return b || null;
  if (!b) return a || null;

  const da = new Date(a);
  const db = new Date(b);

  if (Number.isNaN(da.getTime())) return b;
  if (Number.isNaN(db.getTime())) return a;

  return da.getTime() <= db.getTime() ? a : b;
}

export function calculateDiscardAfterOpenDate(
  medication: Pick<
    SharedMedicationCatalogRecord,
    "openedUsePolicy" | "openedUseDays" | "dosageForm"
  >,
  openedDate: string,
  expirationDate?: string
): string | null {
  if (!openedDate) return null;

  const opened = new Date(openedDate);
  if (Number.isNaN(opened.getTime())) return null;

  const policy = normalizeText(medication.openedUsePolicy).toUpperCase();

  if (policy === "SINGLE_USE") {
    return opened.toISOString();
  }

  if (policy === "UNTIL_MANUFACTURER_EXP" || !policy) {
    return expirationDate || null;
  }

  if (policy === "DAYS_AFTER_OPEN") {
    const days = toNumber(medication.openedUseDays);
    if (days <= 0) return expirationDate || null;

    const discard = new Date(opened);
    discard.setDate(discard.getDate() + days);
    return minIsoDate(discard.toISOString(), expirationDate || null);
  }

  return expirationDate || null;
}

export function getMostRecentActiveOpenedContainer(
  barcode: string,
  sourceLocation: string
): OpenedContainerRecord | null {
  const normalizedBarcode = normalizeText(barcode);
  const normalizedLocation = normalizeText(sourceLocation);

  return (
    getOpenedContainers()
      .filter(
        (item) =>
          item.status === "ACTIVE" &&
          item.barcode === normalizedBarcode &&
          item.sourceLocation === normalizedLocation
      )
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.updatedAt || a.openedDate).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || b.openedDate).getTime();
        return bTime - aTime;
      })[0] || null
  );
}

export function updateOpenedContainer(
  containerId: string,
  updates: Partial<OpenedContainerRecord>
) {
  const all = getOpenedContainers();
  const next = all.map((item) => {
    if (item.containerId !== containerId) return item;
    return {
      ...item,
      ...updates,
      updatedAt: nowIso(),
    };
  });
  saveOpenedContainers(next);
  return next.find((item) => item.containerId === containerId) || null;
}

export function createOpenedContainer(input: OpenContainerInput) {
  const medication = findMedicationByBarcode(input.barcode);

  if (!medication) {
    throw new Error("Barcode not found in shared medication catalog.");
  }

  const existingActive = getMostRecentActiveOpenedContainer(
    input.barcode,
    input.sourceLocation
  );

  if (existingActive && existingActive.remainingQuantity > 0) {
    return {
      record: existingActive,
      existedAlready: true,
    };
  }

  const createdAt = nowIso();
  const containerId = generateContainerId();
  const discardAfterOpenDate = calculateDiscardAfterOpenDate(
    medication,
    input.openedDate,
    input.expirationDate
  );

  const record: OpenedContainerRecord = {
    id: `${containerId}-${createdAt}`,
    containerId,
    barcode: normalizeText(input.barcode),
    medicationName: medication.medicationName,
    strength: medication.strength,
    dosageForm: medication.dosageForm,
    manufacturer: medication.manufacturer,
    ndc: medication.ndc,
    deaSchedule: normalizeDeaSchedule(medication.deaSchedule),
    medicationCategory: medication.medicationCategory,
    openedUsePolicy: medication.openedUsePolicy,
    openedUseDays: medication.openedUseDays,
    requiresOpenedDate: Boolean(medication.requiresOpenedDate),
    requiresContainerTracking: Boolean(medication.requiresContainerTracking),
    sourceLocation: normalizeText(input.sourceLocation),
    lotNumber: normalizeText(input.lotNumber) || undefined,
    expirationDate: normalizeText(input.expirationDate) || undefined,
    openedDate: input.openedDate,
    discardAfterOpenDate,
    initialQuantity: toNumber(input.initialQuantity),
    remainingQuantity: toNumber(input.initialQuantity),
    unit: normalizeText(input.unit) || undefined,
    openedBy: normalizeText(input.openedBy) || undefined,
    witnessName: normalizeText(input.witnessName) || undefined,
    notes: normalizeText(input.notes) || undefined,
    status: "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  };

  const next = [record, ...getOpenedContainers()];
  saveOpenedContainers(next);

  return {
    record,
    existedAlready: false,
  };
}

export function openContainerAndPrintLabel(input: OpenContainerInput) {
  const result = createOpenedContainer(input);

  const zpl = buildVialLabelZpl({
    containerId: result.record.containerId,
    medicationName: result.record.medicationName,
    strength: result.record.strength,
    budDate:
      result.record.discardAfterOpenDate ||
      result.record.expirationDate ||
      result.record.openedDate,
  });

  downloadZplFile(buildVialLabelFilename(result.record.containerId), zpl);

  return result;
}
