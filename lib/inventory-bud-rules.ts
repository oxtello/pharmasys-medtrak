export function calculateDiscardAfterOpenDate(
  openedDate: string,
  dosageForm?: string
): string | null {
  if (!openedDate) return null;

  const opened = new Date(openedDate);
  const form = String(dosageForm || "").trim().toLowerCase();

  const isOphthalmic =
    form.includes("ophthalmic") ||
    form.includes("eye drop") ||
    form.includes("eye drops");

  const isOtic =
    form.includes("otic") ||
    form.includes("ear drop") ||
    form.includes("ear drops");

  const isTopical =
    form.includes("topical") ||
    form.includes("cream") ||
    form.includes("ointment") ||
    form.includes("gel") ||
    form.includes("lotion") ||
    form.includes("solution") ||
    form.includes("powder");

  const isMultiDoseVial =
    form.includes("multi-dose vial") ||
    form.includes("multidose vial") ||
    form.includes("vial") ||
    form.includes("injection");

  // Eye and ear drops stay good until manufacturer expiration
  if (isOphthalmic || isOtic) {
    return null;
  }

  // Topicals also stay good until manufacturer expiration
  if (isTopical && !isMultiDoseVial) {
    return null;
  }

  // Multidose injectable vials = 28 days after opening
  if (isMultiDoseVial) {
    const discard = new Date(opened);
    discard.setDate(discard.getDate() + 28);
    return discard.toISOString();
  }

  return null;
}
