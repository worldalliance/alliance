import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  type AnyField,
  type CityFieldValue,
  forEachCondition,
  forEachOutputViewCondition,
  type FormSchema,
  type FormValue,
  type ListField,
  type NumberField,
  type Page,
  type RangeField,
} from "@alliance/common/forms/form-schema";
import {
  getRankingSlotCount,
  isValidRankingSelection,
} from "@alliance/common/forms/ranking";
import {
  type ConditionExtras,
  isElementCurrentlyVisible,
  isFieldConditionallyRequired,
  isPageCurrentlyVisible,
} from "@alliance/common/forms/visibility";
import {
  CONDITION_KIND_IS_ACCOUNT_DERIVED,
  isKnownConditionKind,
} from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { parseTimeToMinutes } from "@alliance/shared/forms/timeUtils";
import { dropUnuploadedFileAnswers } from "./forms/fileAnswers";
import { defaultCardCount, resolveCards } from "./forms/listCards";

/** Indices into `pages` of the currently visible pages. */
export function getVisiblePageIndices(
  pages: Page[],
  data: Record<string, FormValue>,
  extras: ConditionExtras & { readOnly?: boolean },
): number[] {
  const indices: number[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    if (isPageCurrentlyVisible(pages[index], data, extras)) {
      indices.push(index);
    }
  }
  return indices;
}

/** The first visible page index after `currentIndex`, or null when on/past the last visible page. */
export function getNextVisiblePageIndex(
  visibleIndices: number[],
  currentIndex: number,
): number | null {
  const next = visibleIndices.find((index) => index > currentIndex);
  return next === undefined ? null : next;
}

/** The last visible page index before `currentIndex`, or null when on/before the first visible page. */
export function getPreviousVisiblePageIndex(
  visibleIndices: number[],
  currentIndex: number,
): number | null {
  for (let i = visibleIndices.length - 1; i >= 0; i -= 1) {
    if (visibleIndices[i] < currentIndex) {
      return visibleIndices[i];
    }
  }
  return null;
}

/**
 * Where to move when answers change and hide the page the user is on: the
 * nearest visible page forward, otherwise the closest one before it. Null when
 * no move is needed (the current page is still visible) or possible (no page
 * is visible at all).
 */
export function getFallbackVisiblePageIndex(
  visibleIndices: number[],
  currentIndex: number,
): number | null {
  if (visibleIndices.length === 0 || visibleIndices.includes(currentIndex)) {
    return null;
  }
  return (
    getNextVisiblePageIndex(visibleIndices, currentIndex) ??
    visibleIndices[visibleIndices.length - 1]
  );
}

export const FALLBACK_TIMEZONE = "America/Los_Angeles";
const DEFAULT_RANGE_OPTION_COUNT = 10;
const MIN_RANGE_OPTION_COUNT = 2;
const MAX_RANGE_OPTION_COUNT = 50;

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

type FormElementKind = FormSchema["pages"][number]["fields"][number]["kind"];

const KNOWN_FORM_ELEMENT_KINDS_RECORD = {
  text: true,
  textarea: true,
  email: true,
  number: true,
  range: true,
  phone: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  file: true,
  city: true,
  contract: true,
  list: true,
  ranking: true,
  custom: true,
  header: true,
  label: true,
  divider: true,
  spacer: true,
  html: true,
  images: true,
  video: true,
  quote: true,
  biglink: true,
  copytext: true,
  previousAnswer: true,
  userLocation: true,
  chatTranscript: true,
  accordion: true,
} as const satisfies Record<FormElementKind, true>;

const KNOWN_FORM_ELEMENT_KINDS = new Set(
  Object.keys(KNOWN_FORM_ELEMENT_KINDS_RECORD),
) as Set<FormElementKind>;

/**
 * Returns the first element kind in the schema that the current client doesn't
 * recognize, or null if every element kind is known. Callers use this to block
 * rendering when the schema references blocks added in a newer client version.
 */
export function findUnknownFormElementKind(
  schema: FormSchema,
): FormElementKind | null {
  const findUnknown = (
    element: AnyField | DisplayBlock,
  ): FormElementKind | null => {
    if (!KNOWN_FORM_ELEMENT_KINDS.has(element.kind)) {
      return element.kind;
    }
    if (element.kind !== "accordion") {
      return null;
    }
    for (const section of element.sections) {
      for (const nested of section.blocks) {
        const unknown = findUnknown(nested);
        if (unknown) return unknown;
      }
    }
    return null;
  };

  for (const page of schema.pages ?? []) {
    for (const element of page.fields ?? []) {
      const unknown = findUnknown(element);
      if (unknown) return unknown;
    }
  }
  return null;
}

/**
 * Returns the first condition kind in the schema that the current client
 * doesn't recognize, or null if every kind is known. The condition-level
 * counterpart of `findUnknownFormElementKind`, used the same way: block
 * rendering rather than degrade. An unevaluatable condition treated as "not
 * met" would show the wrong fields or mark a required field optional, and look
 * to the user like a form that works. Output views count too, so a stale
 * client doesn't collect a response it can't render back.
 */
export function findUnknownConditionKind(schema: FormSchema): string | null {
  let unknown: string | null = null;
  const check = (condition: { kind: string }): boolean => {
    if (isKnownConditionKind(condition.kind)) return false;
    unknown = condition.kind;
    return true;
  };
  if (!forEachCondition(schema, check)) {
    forEachOutputViewCondition(schema, check);
  }
  return unknown;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export type UserLocationDisplayValue =
  | CityFieldValue
  | string
  | null
  | undefined;

export function formatUserLocationDisplayValue(
  value: UserLocationDisplayValue,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  const city = parseCityValue(value);
  return city ? formatCityValue(city) : "";
}

/** Whether rendering this schema requires fetching the viewer's visibility context. */
export function schemaNeedsVisibilityContext(schema: FormSchema): boolean {
  // Stops at the first account-derived condition — `forEachCondition` returns
  // whether the visitor stopped it.
  return forEachCondition(
    schema,
    (condition) => CONDITION_KIND_IS_ACCOUNT_DERIVED[condition.kind],
  );
}

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

export function resolveFieldDefaultValue(
  field: AnyField,
): FormValue | undefined {
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
      case "timezone":
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

  if (field.kind === "timezone") {
    return FALLBACK_TIMEZONE;
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

/**
 * Normalize a user id (or fallback id) into the string key used by
 * `DisplayBlock.manualUserContent`. Returns undefined when neither id resolves
 * to a non-empty value.
 */
export function computeActiveUserKey(
  primaryUserId: string | number | null | undefined,
  fallbackUserId: string | number | null | undefined,
): string | undefined {
  const normalizedUserId =
    primaryUserId !== undefined && primaryUserId !== null
      ? primaryUserId
      : fallbackUserId;
  if (normalizedUserId === undefined || normalizedUserId === null) {
    return undefined;
  }
  const asString = String(normalizedUserId);
  return asString.length > 0 ? asString : undefined;
}

/**
 * Collect any `sourceFormId` overrides stored in a block's per-user manual
 * content. Used to prefetch previous-answer schemas/data for users other than
 * the active viewer (e.g. admin previewing different users).
 */
export function collectManualSourceFormIds(block: DisplayBlock): number[] {
  if (!block.manualPerUser || !block.manualUserContent) return [];
  const ids: number[] = [];
  for (const content of Object.values(block.manualUserContent)) {
    const sourceFormId = (content as { sourceFormId?: number }).sourceFormId;
    if (typeof sourceFormId === "number") ids.push(sourceFormId);
  }
  return ids;
}

/**
 * Apply a `manualPerUser` display block's per-user override to the candidate.
 */
export function resolveDisplayBlockForUser<T extends DisplayBlock>(
  candidate: T,
  activeUserKey: string | undefined,
): T {
  if (!candidate.manualPerUser || !activeUserKey) {
    return candidate;
  }
  const manualContent = candidate.manualUserContent?.[activeUserKey];
  if (!manualContent) {
    return candidate;
  }
  return {
    ...candidate,
    ...manualContent,
    kind: candidate.kind,
    id: candidate.id,
    manualPerUser: candidate.manualPerUser,
    manualUserContent: candidate.manualUserContent,
  };
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
 * still has, and only file answers naming an image that reached the server.
 * Callers apply defaults afterwards, since an empty result is what decides
 * which of several stored drafts wins.
 */
export function restorableAnswers(
  answers: Record<string, FormValue> | null,
  allowedFields: Map<string, AnyField>,
): Record<string, FormValue> {
  return dropUnuploadedFileAnswers(
    filterAnswersByFieldIds(answers, allowedFields),
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

export function validateFieldValue(
  field: AnyField,
  fieldValue: FormValue | undefined,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): string | null {
  const required = isFieldConditionallyRequired(field, data, extras);

  const valueToCheck = fieldValue;
  const isEmptyString =
    typeof valueToCheck === "string" && valueToCheck.trim() === "";

  if (field.kind === "multiselect") {
    const selections = Array.isArray(valueToCheck) ? valueToCheck : [];
    if (required && selections.length === 0) {
      return "Select at least one option.";
    }
    if (
      typeof field.maxSelections === "number" &&
      field.maxSelections > 0 &&
      selections.length > field.maxSelections
    ) {
      return `Select no more than ${withCount(field.maxSelections, "option")}.`;
    }
    return null;
  }

  switch (field.kind) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "date":
    case "timezone":
    case "select": {
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
    case "time": {
      if (typeof valueToCheck === "string") {
        const minutes = parseTimeToMinutes(valueToCheck);
        if (minutes === null) {
          return "Enter a valid time.";
        }
      }
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
    case "number": {
      const numValue =
        typeof valueToCheck === "number"
          ? valueToCheck
          : typeof valueToCheck === "string"
            ? parseFloat(valueToCheck)
            : NaN;
      const numberField = field as NumberField;

      if (Number.isNaN(numValue) && !!valueToCheck) {
        return "Please enter a valid number.";
      }
      if (typeof numberField.min === "number" && numValue < numberField.min) {
        return `Value must be at least ${numberField.min}.`;
      }
      if (typeof numberField.max === "number" && numValue > numberField.max) {
        return `Value must be at most ${numberField.max}.`;
      }
      if (
        Number.isFinite(numValue) &&
        !numberField.allowDecimals &&
        !Number.isInteger(numValue)
      ) {
        return "Decimals are not allowed for this field.";
      }
      if (
        Number.isFinite(numValue) &&
        numberField.allowDecimals &&
        typeof numberField.decimalPlaces === "number"
      ) {
        const parts = String(numValue).split(".");
        if (parts.length === 2 && parts[1].length > numberField.decimalPlaces) {
          return `Value must have at most ${withCount(numberField.decimalPlaces, "decimal place")}.`;
        }
      }
      if (!required) return null;
      if (
        valueToCheck === undefined ||
        valueToCheck === null ||
        valueToCheck === ""
      ) {
        return required ? "Please enter a number." : null;
      }

      if (!Number.isFinite(numValue)) {
        return "Please enter a valid number.";
      }
      return null;
    }
    case "range": {
      if (!required) return null;
      if (
        valueToCheck === undefined ||
        valueToCheck === null ||
        valueToCheck === ""
      ) {
        return "Please select a value.";
      }
      if (field.kind !== "range") {
        return "Please select a value.";
      }
      if (!isValidRangeSelection(field, valueToCheck)) {
        return "Please select a value.";
      }
      return null;
    }
    case "ranking": {
      if (
        valueToCheck !== undefined &&
        valueToCheck !== null &&
        !isValidRankingSelection(field, valueToCheck)
      ) {
        return "Please redo your ranking.";
      }
      if (!required) return null;
      const slotCount = getRankingSlotCount(field);
      const rankedCount = Array.isArray(valueToCheck) ? valueToCheck.length : 0;
      if (rankedCount < slotCount) {
        return `Rank ${withCount(slotCount, "item")}.`;
      }
      return null;
    }
    case "checkbox":
      if (!required) return null;
      return valueToCheck === true ? null : "This field is required.";
    case "radio":
      if (!required) return null;
      return valueToCheck ? null : "Please select an option.";
    case "file":
      if (!required) return null;
      return valueToCheck ? null : "Please upload a file.";
    case "list": {
      const listField = field as ListField;
      const listVal = Array.isArray(valueToCheck) ? valueToCheck : [];
      const listValTyped = listVal.every(
        (item): item is Record<string, FormValue> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
        ? listVal
        : [];
      const minCards = Math.max(0, Math.floor(Number(listField.min || 0)));
      const maxCards =
        typeof listField.max === "number" && listField.max >= 0
          ? Math.floor(listField.max)
          : Infinity;
      if (required && listValTyped.length === 0) {
        return "Add at least one item.";
      }
      if (listValTyped.length < minCards) {
        return `Add at least ${withCount(minCards, "item")}.`;
      }
      if (listValTyped.length > maxCards) {
        return `Add no more than ${withCount(maxCards, "item")}.`;
      }
      return null;
    }
    default: {
      if (!required) return null;
      if (valueToCheck === undefined || valueToCheck === null) {
        return "This field is required.";
      }
      if (isEmptyString) {
        return "This field is required.";
      }
      return null;
    }
  }
}

export function getListSubFieldErrors(
  listField: ListField,
  listValue: FormValue | undefined,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const cards = resolveCards({
    value: listValue,
    defaultCardCount: defaultCardCount(listField),
  });
  const subFields = listField.fields ?? [];
  for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
    const card = cards[cardIndex] ?? {};
    const mergedData = { ...data, ...card };
    for (const sub of subFields) {
      const key = `${listField.id}:${cardIndex}:${sub.id}`;
      if (!isElementCurrentlyVisible(sub, mergedData, extras)) {
        result[key] = null;
        continue;
      }
      result[key] = validateFieldValue(sub, card[sub.id], mergedData, extras);
    }
  }
  return result;
}
