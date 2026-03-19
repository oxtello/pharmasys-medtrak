import type {
  MedicationCategory,
  OpenedUsePolicy,
  SharedMedicationCatalogRecord,
} from "@/lib/shared-medication-catalog";

export const OPENED_CONTAINER_STORAGE_KEY = "medtrak-opened-containers";

export type OpenedContainerStatus =
  | "UNOPENED"
  | "ACTIVE"
  | "DISCARDED"
  | "EXPIRED";

export type OpenedContainerRecord = {
  containerId: string;
  barcode: string;
  medicationName: string;
  ndc?: string;
  location: string;
  lotNumber?: string;
  expirationDate?: string;

  medicationCategory?: MedicationCategory;
  openedUsePolicy?: OpenedUsePolicy;
  openedUseDays?: number | null;

  openedAt?: string | null;
  discardAfterOpenDate?: string | null;

  status: OpenedContainerStatus;
  remainingQuantity?: string | null;

  createdAt: string;
  updatedAt: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined";
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized ? normalized : undefined;
}

function normalizeStatus(value: unknown): OpenedContainerStatus {
  const raw = normalizeString(value).toUpperCase();

  if (raw === "UNOPENED") return "UNOPENED";
  if (raw === "ACTIVE") return "ACTIVE";
  if (raw === "DISCARDED") return "DISCARDED";
  if (raw === "EXPIRED") return "EXPIRED";

  return "ACTIVE";
}

export function calculateDiscardAfterOpenDate(
  openedAt: string,
  expirationDate?: string,
  openedUsePolicy?: OpenedUsePolicy,
  openedUseDays?: number | null
): string | null {
  if (!openedAt) return expirationDate || null;

  if (openedUsePolicy === "UNTIL_MANUFACTURER_EXP") {
    return expirationDate || null;
  }

  if (openedUsePolicy === "SINGLE_USE") {
    return openedAt;
  }

  if (openedUsePolicy === "DAYS_AFTER_OPEN" && openedUseDays) {
    const opened = new Date(openedAt);
    if (Number.isNaN(opened.getTime())) return expirationDate || null;

    opened.setDate(opened.getDate() + openedUseDays);
    const calculated = opened.toISOString();

    if (!expirationDate) return calculated;

    const calculatedTime = new Date(calculated).getTime();
    const expirationTime = new Date(expirationDate).getTime();

    if (Number.isNaN(expirationTime)) return calculated;

    return calculatedTime < expirationTime ? calculated : expirationDate;
  }

  return expirationDate || null;
}

function normalizeOpenedContainerRecord(
  raw: Partial<OpenedContainerRecord>
): OpenedContainerRecord {
  const createdAt =
    normalizeString(raw.createdAt) || new Date().toISOString();
  const openedAt =
    raw.openedAt === null
      ? null
      : normalizeOptionalString(raw.openedAt) || createdAt;

  const normalized: OpenedContainerRecord = {
    containerId:
      normalizeString(raw.containerId) ||
      `OC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    barcode: normalizeString(raw.barcode),
    medicationName: normalizeString(raw.medicationName) || "Unknown Medication",
    ndc: normalizeOptionalString(raw.ndc),
    location: normalizeString(raw.location) || "Main Campus",
    lotNumber: normalizeOptionalString(raw.lotNumber),
    expirationDate: normalizeOptionalString(raw.expirationDate),

    medicationCategory: raw.medicationCategory,
    openedUsePolicy: raw.openedUsePolicy,
    openedUseDays:
      typeof raw.openedUseDays === "number" && Number.isFinite(raw.openedUseDays)
        ? raw.openedUseDays
        : null,

    openedAt,
    discardAfterOpenDate:
      raw.discardAfterOpenDate === null
        ? null
        : normalizeOptionalString(raw.discardAfterOpenDate) || null,

    status: normalizeStatus(raw.status),
    remainingQuantity:
      raw.remainingQuantity !== undefined && raw.remainingQuantity !== null
        ? String(raw.remainingQuantity)
        : null,

    createdAt,
    updatedAt:
      normalizeString(raw.updatedAt) || createdAt,
  };

  normalized.discardAfterOpenDate = calculateDiscardAfterOpenDate(
    normalized.openedAt || normalized.createdAt,
    normalized.expirationDate,
    normalized.openedUsePolicy,
    normalized.openedUseDays
  );

  return normalized;
}

export function safeReadOpenedContainers(): OpenedContainerRecord[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = localStorage.getItem(OPENED_CONTAINER_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Partial<OpenedContainerRecord>[])
      : [];

    return parsed.map((item) => normalizeOpenedContainerRecord(item));
  } catch {
    return [];
  }
}

export function saveOpenedContainers(records: OpenedContainerRecord[]) {
  if (!canUseLocalStorage()) return;

  localStorage.setItem(
    OPENED_CONTAINER_STORAGE_KEY,
    JSON.stringify(records.map((item) => normalizeOpenedContainerRecord(item)))
  );
}

function createOpenedContainerRecord(
  input: Omit<
    Partial<OpenedContainerRecord>,
    "containerId" | "createdAt" | "updatedAt" | "status" | "discardAfterOpenDate"
  > & {
    barcode: string;
    medicationName: string;
    location: string;
  }
): OpenedContainerRecord {
  const now = new Date().toISOString();
  const openedAtIso =
    normalizeOptionalString(input.openedAt) || now;

  return normalizeOpenedContainerRecord({
    containerId: `OC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    barcode: input.barcode,
    medicationName: input.medicationName,
    ndc: input.ndc,
    location: input.location,
    lotNumber: input.lotNumber,
    expirationDate: input.expirationDate,
    medicationCategory: input.medicationCategory,
    openedUsePolicy: input.openedUsePolicy,
    openedUseDays: input.openedUseDays,
    openedAt: openedAtIso,
    status: "ACTIVE",
    remainingQuantity:
      input.remainingQuantity !== undefined && input.remainingQuantity !== null
        ? String(input.remainingQuantity)
        : null,
    createdAt: now,
    updatedAt: now,
  });
}

export function addOpenedContainer(
  input: Omit<
    Partial<OpenedContainerRecord>,
    "containerId" | "createdAt" | "updatedAt" | "status" | "discardAfterOpenDate"
  > & {
    barcode: string;
    medicationName: string;
    location: string;
  }
) {
  const all = safeReadOpenedContainers();
  const record = createOpenedContainerRecord(input);
  const next = [record, ...all];
  saveOpenedContainers(next);
  return record;
}

export function updateOpenedContainer(
  containerId: string,
  updates: Partial<OpenedContainerRecord>
) {
  const all = safeReadOpenedContainers();

  const next = all.map((record) => {
    if (record.containerId !== containerId) return record;

    return normalizeOpenedContainerRecord({
      ...record,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  });

  saveOpenedContainers(next);
  return next.find((record) => record.containerId === containerId) || null;
}

export function markOpenedContainerDiscarded(containerId: string) {
  return updateOpenedContainer(containerId, {
    status: "DISCARDED",
    remainingQuantity: "0",
  });
}

export function findActiveOpenedContainersByBarcodeAndLocation(
  barcode: string,
  location: string
) {
  const normalizedBarcode = normalizeString(barcode);
  const normalizedLocation = normalizeString(location);

  return safeReadOpenedContainers().filter(
    (record) =>
      record.status === "ACTIVE" &&
      record.barcode === normalizedBarcode &&
      record.location === normalizedLocation
  );
}

export function getMostRecentActiveOpenedContainer(
  barcode: string,
  location: string
) {
  const matches = findActiveOpenedContainersByBarcodeAndLocation(
    barcode,
    location
  );

  return matches.sort((a, b) => {
    const aTime = new Date(a.openedAt || a.createdAt).getTime();
    const bTime = new Date(b.openedAt || b.createdAt).getTime();
    return bTime - aTime;
  })[0];
}

export function isContainerExpiredAfterOpen(record: OpenedContainerRecord) {
  if (!record.discardAfterOpenDate) return false;

  const discardTime = new Date(record.discardAfterOpenDate).getTime();
  if (Number.isNaN(discardTime)) return false;

  return Date.now() > discardTime;
}

/* compatibility helpers for pages written against earlier names */
export function createOpenedContainerRecordFromMedication(
  medication: SharedMedicationCatalogRecord,
  location: string,
  options?: {
    lotNumber?: string;
    expirationDate?: string;
    openedAt?: string;
    remainingQuantity?: string;
  }
) {
  return addOpenedContainer({
    barcode: medication.barcode,
    medicationName: medication.medicationName,
    ndc: medication.ndc,
    location,
    lotNumber: options?.lotNumber,
    expirationDate: options?.expirationDate,
    medicationCategory: medication.medicationCategory,
    openedUsePolicy: medication.openedUsePolicy,
    openedUseDays: medication.openedUseDays,
    openedAt: options?.openedAt,
    remainingQuantity: options?.remainingQuantity,
  });
}

export function findOpenContainersForMedication(
  barcode: string,
  location?: string
) {
  if (!location) {
    return safeReadOpenedContainers().filter(
      (record) =>
        record.status === "ACTIVE" &&
        record.barcode === normalizeString(barcode)
    );
  }

  return findActiveOpenedContainersByBarcodeAndLocation(barcode, location);
}

export function markContainerDiscarded(containerId: string) {
  return markOpenedContainerDiscarded(containerId);
}

export function upsertOpenedContainer(record: OpenedContainerRecord) {
  const current = safeReadOpenedContainers();
  const next = current.filter((item) => item.containerId !== record.containerId);
  next.unshift(normalizeOpenedContainerRecord(record));
  saveOpenedContainers(next);
  return record;
}

export function buildOpenedContainerFromMedication(
  medication: SharedMedicationCatalogRecord,
  location: string,
  options?: {
    lotNumber?: string;
    expirationDate?: string;
    openedAt?: string;
    remainingQuantity?: string;
  }
) {
  return createOpenedContainerRecordFromMedication(medication, location, options);
}
