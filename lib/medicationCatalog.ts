export type MedicationCatalogItem = {
  barcode: string;
  medicationName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  ndc: string;
  deaSchedule?: string;
  unit?: string;
};

export const medicationCatalog: MedicationCatalogItem[] = [
  {
    barcode: "123456789012",
    medicationName: "Morphine Sulfate",
    strength: "2 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Hospira",
    ndc: "0409-1234",
    deaSchedule: "C2",
    unit: "mL",
  },
  {
    barcode: "234567890123",
    medicationName: "Lorazepam",
    strength: "1 mg",
    dosageForm: "Tablet",
    manufacturer: "Teva",
    ndc: "00093-1234",
    deaSchedule: "C4",
    unit: "tablet",
  },
  {
    barcode: "345678901234",
    medicationName: "Ondansetron",
    strength: "4 mg",
    dosageForm: "Tablet",
    manufacturer: "Sandoz",
    ndc: "0781-1234",
    deaSchedule: "",
    unit: "tablet",
  },
  {
    barcode: "456789012345",
    medicationName: "Insulin Glargine",
    strength: "100 units/mL",
    dosageForm: "Injection",
    manufacturer: "Sanofi",
    ndc: "00088-2222",
    deaSchedule: "",
    unit: "mL",
  },
  {
    barcode: "567890123456",
    medicationName: "Fentanyl Citrate",
    strength: "50 mcg/mL",
    dosageForm: "Injection",
    manufacturer: "Pfizer",
    ndc: "00409-8090",
    deaSchedule: "C2",
    unit: "mL",
  },
  {
    barcode: "678901234567",
    medicationName: "Midazolam",
    strength: "5 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Hospira",
    ndc: "0409-2305",
    deaSchedule: "C4",
    unit: "mL",
  },
  {
    barcode: "789012345678",
    medicationName: "Ketamine",
    strength: "50 mg/mL",
    dosageForm: "Injection",
    manufacturer: "Par",
    ndc: "42023-115",
    deaSchedule: "C3",
    unit: "mL",
  },
  {
    barcode: "890123456789",
    medicationName: "Oxycodone",
    strength: "5 mg",
    dosageForm: "Tablet",
    manufacturer: "Mallinckrodt",
    ndc: "00406-0523",
    deaSchedule: "C2",
    unit: "tablet",
  },
];

export function findMedicationByBarcode(barcode: string): MedicationCatalogItem | null {
  const normalized = barcode.trim();
  if (!normalized) return null;
  return medicationCatalog.find((item) => item.barcode === normalized) || null;
}
