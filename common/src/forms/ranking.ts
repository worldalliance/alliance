import type { FormValue, RankingField } from "./form-schema";

/** Number of rank slots to show: `numToRank` clamped to [1, options.length]. */
export function getRankingSlotCount(field: RankingField): number {
  const optionCount = field.options.length;
  const desired = field.numToRank ?? optionCount;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : optionCount;
  return Math.min(optionCount, Math.max(1, normalized));
}

/** The markdown label for a ranked option value, falling back to the raw value. */
export function getRankingOptionLabel(
  field: RankingField,
  value: string,
): string {
  return field.options.find((option) => option.value === value)?.label ?? value;
}

const optionValues = (field: RankingField): string[] =>
  field.options.map((option) => option.value);

/**
 * A (possibly partial) ranking answer: distinct option values from
 * `field.options`, in rank order, at most one per slot.
 */
export function isValidRankingSelection(
  field: RankingField,
  value: unknown,
): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length > getRankingSlotCount(field)) {
    return false;
  }
  const values = optionValues(field);
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return false;
    if (!values.includes(entry)) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

/**
 * Drop stale/duplicate ranking entries so UIs never render options that no
 * longer exist in the schema (e.g. after an admin edits the option list).
 */
export function sanitizeRankingValue(
  field: RankingField,
  value: FormValue | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  const slotCount = getRankingSlotCount(field);
  const values = optionValues(field);
  const ranked: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if (!values.includes(entry) || ranked.includes(entry)) continue;
    ranked.push(entry);
    if (ranked.length >= slotCount) break;
  }
  return ranked;
}
