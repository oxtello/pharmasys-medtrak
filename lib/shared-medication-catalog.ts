import { findMedicationMasterByBarcode } from "@/lib/medication-master-admin";

export type OpenedUsePolicy =
  | "UNTIL_MANUFACTURER_EXP"
  | "DAYS_AFTER_OPEN"
  | "SINGLE_USE";

export type MedicationCategory =
  | "VIAL"
  | "AMPULE"
  | "SYRINGE"
  | "BAG"
  | "BOTTLE"
  | "TABLET"
  | "CAPSULE"
  | "PATCH"
  | "INHALER"
  | "EYE_DROPS"
  | "EAR_DROPS"
  | "TOPICAL_CREAM"
  | "TOPICAL_OINTMENT"
  | "TOPICAL_GEL"
  | "TOPICAL_SOLUTION"
  | "POWDER"
  | "OTHER";

export type SharedMedicationCatalogRecord = {
  barcode: string;
  ndc: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  deaSchedule?: string;
  isControlled: boolean;
  medicationCategory: MedicationCategory;
  inventoryUnit: string;
  isMultidose: boolean;
  openedUsePolicy: OpenedUsePolicy;
  openedUseDays: number | null;
  requiresOpenedDate: boolean;
  requiresContainerTracking: boolean;
};

type MedicationMasterLookupRecord = {
  barcode?: unknown;
  ndc?: unknown;
  name?: unknown;
  medicationName?: unknown;
  strength?: unknown;
  dosageForm?: unknown;
  manufacturer?: unknown;
  deaSchedule?: unknown;
  medicationCategory?: unknown;
  inventoryUnit?: unknown;
  isMultiDose?: unknown;
  isMultidose?: unknown;
  openedUsePolicy?: unknown;
  openedUseDays?: unknown;
  requiresOpenedDate?: unknown;
  requiresContainerTracking?: unknown;
  requiresWitnessWaste?: unknown;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
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

export function safeReadJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeDeaSchedule(value: unknown): string {
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

  if (normalized === "2" || normalized === "II" || normalized === "SCHEDULE II" || normalized === "C-II") {
    return "C2";
  }

  if (normalized === "3" || normalized === "III" || normalized === "SCHEDULE III" || normalized === "C-III") {
    return "C3";
  }

  if (normalized === "4" || normalized === "IV" || normalized === "SCHEDULE IV" || normalized === "C-IV") {
    return "C4";
  }

  if (normalized === "5" || normalized === "V" || normalized === "SCHEDULE V" || normalized === "C-V") {
    return "C5";
  }

  return "";
}

function normalizeMedicationCategory(value: unknown): MedicationCategory {
  const normalized = normalizeUpper(value);

  switch (normalized) {
    case "VIAL":
      return "VIAL";
    case "AMPULE":
    case "AMPOULE":
      return "AMPULE";
    case "SYRINGE":
      return "SYRINGE";
    case "BAG":
      return "BAG";
    case "BOTTLE":
      return "BOTTLE";
    case "TABLET":
      return "TABLET";
    case "CAPSULE":
      return "CAPSULE";
    case "PATCH":
      return "PATCH";
    case "INHALER":
      return "INHALER";
    case "EYE_DROPS":
    case "EYE DROPS":
    case "OPHTHALMIC":
      return "EYE_DROPS";
    case "EAR_DROPS":
    case "EAR DROPS":
    case "OTIC":
      return "EAR_DROPS";
    case "TOPICAL_CREAM":
    case "TOPICAL CREAM":
    case "CREAM":
      return "TOPICAL_CREAM";
    case "TOPICAL_OINTMENT":
    case "TOPICAL OINTMENT":
    case "OINTMENT":
      return "TOPICAL_OINTMENT";
    case "TOPICAL_GEL":
    case "TOPICAL GEL":
    case "GEL":
      return "TOPICAL_GEL";
    case "TOPICAL_SOLUTION":
    case "TOPICAL SOLUTION":
    case "SOLUTION":
      return "TOPICAL_SOLUTION";
    case "POWDER":
      return "POWDER";
    default:
      return "OTHER";
  }
}

function normalizeOpenedUsePolicy(
  value: unknown,
  isMultidose: boolean,
  category: MedicationCategory
): OpenedUsePolicy {
  const normalized = normalizeUpper(value);

  if (!isMultidose) {
    return "SINGLE_USE";
  }

  if (normalized === "DAYS_AFTER_OPEN") {
    return "DAYS_AFTER_OPEN";
  }

  if (normalized === "UNTIL_MANUFACTURER_EXP") {
    return "UNTIL_MANUFACTURER_EXP";
  }

  if (
    category === "EYE_DROPS" ||
    category === "EAR_DROPS" ||
    category === "TOPICAL_CREAM" ||
    category === "TOPICAL_OINTMENT" ||
    category === "TOPICAL_GEL" ||
    category === "TOPICAL_SOLUTION" ||
    category === "POWDER"
  ) {
    return "UNTIL_MANUFACTURER_EXP";
  }

  return "DAYS_AFTER_OPEN";
}

function inferDefaultPolicy(
  category: MedicationCategory,
  isMultidose: boolean
): Pick<
  SharedMedicationCatalogRecord,
  "openedUsePolicy" | "openedUseDays" | "requiresOpenedDate" | "requiresContainerTracking"
> {
  if (!isMultidose) {
    return {
      openedUsePolicy: "SINGLE_USE",
      openedUseDays: null,
      requiresOpenedDate: false,
      requiresContainerTracking: false,
    };
  }

  switch (category) {
    case "EYE_DROPS":
    case "EAR_DROPS":
    case "TOPICAL_CREAM":
    case "TOPICAL_OINTMENT":
    case "TOPICAL_GEL":
    case "TOPICAL_SOLUTION":
    case "POWDER":
      return {
        openedUsePolicy: "UNTIL_MANUFACTURER_EXP",
        openedUseDays: null,
        requiresOpenedDate: false,
        requiresContainerTracking: false,
      };

    case "VIAL":
    case "BOTTLE":
    default:
      return {
        openedUsePolicy: "DAYS_AFTER_OPEN",
        openedUseDays: 28,
        requiresOpenedDate: true,
        requiresContainerTracking: true,
      };
  }
}

export function normalizeSharedMedicationCatalogRecord(
  input: Partial<SharedMedicationCatalogRecord>
): SharedMedicationCatalogRecord {
  const barcode = normalizeText(input.barcode);
  const ndc = normalizeText(input.ndc);
  const medicationName = normalizeText(input.medicationName);
  const strength = normalizeText(input.strength);
  const dosageForm = normalizeText(input.dosageForm);
  const manufacturer = normalizeText(input.manufacturer);
  const deaSchedule = normalizeDeaSchedule(input.deaSchedule);
  const medicationCategory = normalizeMedicationCategory(input.medicationCategory);
  const inventoryUnit = normalizeText(input.inventoryUnit) || "EACH";
  const isControlled =
    typeof input.isControlled === "boolean"
      ? input.isControlled
      : deaSchedule !== "";
  const isMultidose = toBoolean(input.isMultidose);

  const defaults = inferDefaultPolicy(medicationCategory, isMultidose);

  const openedUsePolicy = normalizeOpenedUsePolicy(
    input.openedUsePolicy ?? defaults.openedUsePolicy,
    isMultidose,
    medicationCategory
  );

  const openedUseDays =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toNumberOrNull(input.openedUseDays) ?? defaults.openedUseDays
      : null;

  const requiresOpenedDate =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toBoolean(input.requiresOpenedDate, defaults.requiresOpenedDate)
      : false;

  const requiresContainerTracking =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toBoolean(
          input.requiresContainerTracking,
          defaults.requiresContainerTracking
        )
      : false;

  return {
    barcode,
    ndc,
    medicationName,
    strength,
    dosageForm,
    manufacturer,
    deaSchedule: deaSchedule || undefined,
    isControlled,
    medicationCategory,
    inventoryUnit,
    isMultidose,
    openedUsePolicy,
    openedUseDays,
    requiresOpenedDate,
    requiresContainerTracking,
  };
}

function mapMedicationMasterToSharedRecord(
  record: MedicationMasterLookupRecord
): SharedMedicationCatalogRecord {
  const barcode = normalizeText(record.barcode);
  const medicationName =
    normalizeText(record.name) || normalizeText(record.medicationName);
  const strength = normalizeText(record.strength);
  const dosageForm = normalizeText(record.dosageForm);
  const manufacturer = normalizeText(record.manufacturer);
  const ndc = normalizeText(record.ndc);
  const deaSchedule = normalizeDeaSchedule(record.deaSchedule);
  const medicationCategory = normalizeMedicationCategory(record.medicationCategory);
  const inventoryUnit = normalizeText(record.inventoryUnit) || "EACH";
  const isMultidose = toBoolean(
    record.isMultiDose,
    toBoolean(record.isMultidose, false)
  );

  const defaults = inferDefaultPolicy(medicationCategory, isMultidose);

  const openedUsePolicy = normalizeOpenedUsePolicy(
    record.openedUsePolicy ?? defaults.openedUsePolicy,
    isMultidose,
    medicationCategory
  );

  const openedUseDays =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toNumberOrNull(record.openedUseDays) ?? defaults.openedUseDays
      : null;

  const requiresOpenedDate =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toBoolean(record.requiresOpenedDate, defaults.requiresOpenedDate)
      : false;

  const requiresContainerTracking =
    openedUsePolicy === "DAYS_AFTER_OPEN"
      ? toBoolean(
          record.requiresContainerTracking,
          defaults.requiresContainerTracking
        )
      : false;

  return normalizeSharedMedicationCatalogRecord({
    barcode,
    ndc,
    medicationName,
    strength,
    dosageForm,
    manufacturer,
    deaSchedule,
    isControlled: deaSchedule !== "",
    medicationCategory,
    inventoryUnit,
    isMultidose,
    openedUsePolicy,
    openedUseDays,
    requiresOpenedDate,
    requiresContainerTracking,
  });
}

export const SHARED_MEDICATION_CATALOG: SharedMedicationCatalogRecord[] = [
  normalizeSharedMedicationCatalogRecord({
    barcode: "0123456789012",
    ndc: "0409-4276-02",
    medicationName: "Lidocaine",
    strength: "1%",
    dosageForm: "Injection",
    manufacturer: "Hospira",
    deaSchedule: "",
    medicationCategory: "VIAL",
    inventoryUnit: "ML",
    isMultidose: true,
    openedUsePolicy: "DAYS_AFTER_OPEN",
    openedUseDays: 28,
    requiresOpenedDate: true,
    requiresContainerTracking: true,
  }),
  normalizeSharedMedicationCatalogRecord({
    barcode: "1111111111111",
    ndc: "12345-678-90",
    medicationName: "Bupivacaine",
    strength: "0.25%",
    dosageForm: "Injection",
    manufacturer: "Generic",
    deaSchedule: "",
    medicationCategory: "VIAL",
    inventoryUnit: "ML",
    isMultidose: true,
    openedUsePolicy: "DAYS_AFTER_OPEN",
    openedUseDays: 28,
    requiresOpenedDate: true,
    requiresContainerTracking: true,
  }),
  normalizeSharedMedicationCatalogRecord({
    barcode: "2222222222222",
    ndc: "00002-8215-01",
    medicationName: "Testosterone Cypionate",
    strength: "200 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Generic",
    deaSchedule: "C3",
    medicationCategory: "VIAL",
    inventoryUnit: "ML",
    isMultidose: true,
    openedUsePolicy: "DAYS_AFTER_OPEN",
    openedUseDays: 28,
    requiresOpenedDate: true,
    requiresContainerTracking: true,
  }),
  normalizeSharedMedicationCatalogRecord({
    barcode: "3333333333333",
    ndc: "00065-0093-02",
    medicationName: "Ketamine",
    strength: "50 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Generic",
    deaSchedule: "C3",
    medicationCategory: "VIAL",
    inventoryUnit: "ML",
    isMultidose: true,
    openedUsePolicy: "DAYS_AFTER_OPEN",
    openedUseDays: 28,
    requiresOpenedDate: true,
    requiresContainerTracking: true,
  }),
  normalizeSharedMedicationCatalogRecord({
    barcode: "4444444444444",
    ndc: "00591-0461-01",
    medicationName: "Atropine Sulfate Ophthalmic",
    strength: "1%",
    dosageForm: "Eye drops",
    manufacturer: "Generic",
    deaSchedule: "",
    medicationCategory: "EYE_DROPS",
    inventoryUnit: "ML",
    isMultidose: true,
    openedUsePolicy: "UNTIL_MANUFACTURER_EXP",
    openedUseDays: null,
    requiresOpenedDate: false,
    requiresContainerTracking: false,
  }),
  normalizeSharedMedicationCatalogRecord({
    barcode: "5555555555555",
    ndc: "51672-1387-06",
    medicationName: "Hydrocortisone Cream",
    strength: "1%",
    dosageForm: "Cream",
    manufacturer: "Generic",
    deaSchedule: "",
    medicationCategory: "TOPICAL_CREAM",
    inventoryUnit: "TUBE",
    isMultidose: true,
    openedUsePolicy: "UNTIL_MANUFACTURER_EXP",
    openedUseDays: null,
    requiresOpenedDate: false,
    requiresContainerTracking: false,
  }),
];

export function getSharedMedicationCatalog() {
  return [...SHARED_MEDICATION_CATALOG];
}

export function findMedicationByBarcode(
  barcode: string
): SharedMedicationCatalogRecord | null {
  const normalizedBarcode = normalizeText(barcode);
  if (!normalizedBarcode) return null;

  const medicationMasterRecord = findMedicationMasterByBarcode(
    normalizedBarcode
  ) as MedicationMasterLookupRecord | null;

  if (medicationMasterRecord) {
    return mapMedicationMasterToSharedRecord(medicationMasterRecord);
  }

  const match = SHARED_MEDICATION_CATALOG.find(
    (item) => normalizeText(item.barcode) === normalizedBarcode
  );

  return match ? normalizeSharedMedicationCatalogRecord(match) : null;
}

export function findSharedMedicationByBarcode(
  barcode: string
): SharedMedicationCatalogRecord | null {
  return findMedicationByBarcode(barcode);
}
