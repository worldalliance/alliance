import { parseCityValue } from "@alliance/common/forms/city";
import type {
  AnyField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import { isValidRangeSelection } from "@alliance/common/forms/range";
import { isValidRankingSelection } from "@alliance/common/forms/ranking";
import { dropUnuploadedFileAnswers } from "./fileAnswers";
import { dropUnknownOptionAnswers } from "./optionAnswers";

/**
 * Compute a stable storage key for a form draft.
 * Format: `form:<slug>:v<version>[:<instanceId>]`
 */
export function computeFormStorageKey(args: {
  formId: number;
  instanceId?: string | number | null;
}): string {
  const base = `form:${args.formId}`;
  const hasInstance =
    args.instanceId !== undefined &&
    args.instanceId !== null &&
    args.instanceId !== "";
  return hasInstance ? `${base}:${String(args.instanceId)}` : base;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function resolveFieldDefaultValue(
  field: AnyField,
  timeZone: string | undefined,
): FormValue | undefined {
  if (field.kind === "timezone") {
    return timeZone;
  }

  const rawDefault = field.defaultValue;

  if (rawDefault === null) {
    return undefined;
  }

  if (rawDefault !== undefined) {
    switch (field.kind) {
      case "radio":
      case "select": {
        if (typeof rawDefault !== "string" || !isNonEmptyString(rawDefault)) {
          return undefined;
        }
        const values = field.options?.map((option) => option.value) ?? [];
        return values.includes(rawDefault) ? rawDefault : undefined;
      }
      case "multiselect": {
        if (!Array.isArray(rawDefault) || rawDefault.length === 0) {
          return undefined;
        }
        const validValues = field.options?.map((option) => option.value) ?? [];
        const filtered = rawDefault.filter(
          (value): value is string =>
            typeof value === "string" && validValues.includes(value),
        );
        return filtered.length ? filtered : undefined;
      }
      case "checkbox":
        return typeof rawDefault === "boolean" ? rawDefault : undefined;
      case "number":
        return typeof rawDefault === "number" ? rawDefault : undefined;
      case "range":
        return field.kind === "range" &&
          isValidRangeSelection(field, rawDefault)
          ? rawDefault
          : undefined;
      case "ranking":
        return isValidRankingSelection(field, rawDefault)
          ? rawDefault
          : undefined;
      case "time":
      case "date":
      case "text":
      case "textarea":
      case "email":
      case "phone":
      case "file":
      case "custom":
        return isNonEmptyString(rawDefault) ? rawDefault : undefined;
      case "city":
        return (
          parseCityValue(rawDefault) ??
          (isNonEmptyString(rawDefault) ? rawDefault : undefined)
        );
      default:
        return isNonEmptyString(rawDefault) ? rawDefault : undefined;
    }
  }

  if (field.kind === "list") {
    const listField = field as ListField;
    const defaultNumber = Math.max(
      0,
      Math.floor(Number(listField.defaultNumber) || 0),
    );
    return Array.from({ length: defaultNumber }, () => ({})) as FormValue;
  }

  return undefined;
}

export function applyDefaultValues(
  base: Record<string, FormValue> | undefined,
  defaults: Map<string, FormValue>,
): Record<string, FormValue> {
  if (!defaults.size) {
    return base ? base : {};
  }

  let result = base ?? {};
  let mutated = false;

  for (const [fieldId, defaultValue] of defaults.entries()) {
    const current = result[fieldId];
    if (current === undefined || current === null) {
      if (!mutated) {
        result = base ? { ...base } : { ...result };
        mutated = true;
      }
      result[fieldId] = defaultValue;
    }
  }

  if (mutated) {
    return result;
  }

  return base ? base : {};
}

export function filterAnswersByFieldIds(
  answers: Record<string, FormValue> | null,
  allowedFields: Map<string, AnyField>,
): Record<string, FormValue> {
  if (!answers) {
    return {};
  }

  const filtered: Record<string, FormValue> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    if (allowedFields.has(fieldId)) {
      filtered[fieldId] = value;
    }
  }
  return filtered;
}

/**
 * The answers a renderer should start a draft from: only fields the schema
 * still has, only multiselect selections of fixed options the field still has,
 * only range answers the field still offers, and only file answers naming an
 * image that reached the server. Callers apply
 * defaults afterwards, since an empty result is what decides which of several
 * stored drafts wins.
 */
export function restorableAnswers(
  answers: Record<string, FormValue> | null,
  allowedFields: Map<string, AnyField>,
): Record<string, FormValue> {
  return dropUnuploadedFileAnswers(
    dropUnknownOptionAnswers(
      filterAnswersByFieldIds(answers, allowedFields),
      allowedFields,
    ),
    allowedFields,
  );
}

/**
 * The public/private choices a renderer should restore: only fields the schema
 * still publishes, and only genuine booleans.
 */
export function restorablePublicAnswers(
  publicAnswers: Record<string, unknown> | null | undefined,
  outputFieldIds: Set<string>,
): Record<string, boolean> {
  const restorable: Record<string, boolean> = {};
  if (!publicAnswers) {
    return restorable;
  }
  for (const [fieldId, value] of Object.entries(publicAnswers)) {
    if (outputFieldIds.has(fieldId) && typeof value === "boolean") {
      restorable[fieldId] = value;
    }
  }
  return restorable;
}
