import {
  MAX_RANGE_OPTION_COUNT,
  MIN_RANGE_OPTION_COUNT,
  type RangeField,
} from "./form-schema";

const DEFAULT_RANGE_OPTION_COUNT = 10;

export function getRangeOptionCount(field: RangeField): number {
  const desired = field.optionCount ?? DEFAULT_RANGE_OPTION_COUNT;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : DEFAULT_RANGE_OPTION_COUNT;
  return Math.min(
    MAX_RANGE_OPTION_COUNT,
    Math.max(MIN_RANGE_OPTION_COUNT, normalized),
  );
}

export function getRangeValues(field: RangeField): number[] {
  return Array.from(
    { length: getRangeOptionCount(field) },
    (_, index) => index + 1,
  );
}

export function isValidRangeSelection(
  field: RangeField,
  value: unknown,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  if (field.kind !== "range") {
    return false;
  }
  const max = getRangeOptionCount(field);
  return value >= 1 && value <= max;
}
