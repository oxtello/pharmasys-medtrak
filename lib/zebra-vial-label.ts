const LABEL_WIDTH_DOTS = 300; // 1.0" at 300 dpi
const LABEL_HEIGHT_DOTS = 150; // 0.5" at 300 dpi

function safeZplText(value: string) {
  return String(value || "")
    .replace(/[\\^~]/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

function formatBudForLabel(value?: string | null) {
  if (!value) return "BUD UNKNOWN";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `BUD ${safeZplText(value).toUpperCase()}`;
  }

  const formatted = date
    .toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/,/g, "")
    .toUpperCase();

  return `BUD ${formatted}`;
}

function shortenMedicationLine(name?: string, strength?: string) {
  const raw = [name, strength].filter(Boolean).join(" ").trim();
  const cleaned = safeZplText(raw).toUpperCase();
  return cleaned.length > 22 ? cleaned.slice(0, 22).trim() : cleaned;
}

export type VialLabelInput = {
  containerId: string;
  medicationName: string;
  strength?: string;
  budDate?: string | null;
};

export function buildVialLabelFilename(containerId: string) {
  const clean = safeZplText(containerId).replace(/\s+/g, "_");
  return `${clean || "opened-container-label"}.zpl`;
}

export function buildVialLabelZpl(input: VialLabelInput) {
  const medLine = shortenMedicationLine(input.medicationName, input.strength);
  const budLine = formatBudForLabel(input.budDate);
  const barcodePayload = `MEDTRAK:CONT:${safeZplText(input.containerId)}`;

  return [
    "^XA",
    "^PW300",
    "^LL150",
    "^LH0,0",
    "^CI28",
    `^FO8,14^BXN,4,200,14,14,1^FD${barcodePayload}^FS`,
    `^FO95,18^A0N,26,24^FD${medLine}^FS`,
    `^FO95,64^A0N,24,22^FD${safeZplText(budLine)}^FS`,
    "^XZ",
  ].join("\n");
}

export function downloadZplFile(filename: string, zpl: string) {
  if (typeof window === "undefined") return;

  const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(value: string) {
  if (typeof window === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch {
    return false;
  }
}

export function getVialLabelPreviewLines(input: VialLabelInput) {
  return {
    barcodePayload: `MEDTRAK:CONT:${input.containerId}`,
    medicationLine: shortenMedicationLine(input.medicationName, input.strength),
    budLine: formatBudForLabel(input.budDate),
    widthDots: LABEL_WIDTH_DOTS,
    heightDots: LABEL_HEIGHT_DOTS,
  };
}
