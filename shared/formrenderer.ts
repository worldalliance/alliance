import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  forEachCondition,
  forEachOutputViewCondition,
} from "@alliance/common/forms/form-conditions";
import {
  type CityFieldValue,
  type FormSchema,
  type FormValue,
  type Page,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import {
  type ConditionExtras,
  isPageCurrentlyVisible,
} from "@alliance/common/forms/visibility";
import {
  CONDITION_KIND_IS_ACCOUNT_DERIVED,
  isKnownConditionKind,
} from "@alliance/common/forms/visible-if-formula";

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
  const findUnknown = (element: PageItem): FormElementKind | null => {
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

export type RandomizationKeyArgs = {
  formId: number;
  activeUserKey: string | null | undefined;
  persistKey?: string | number | null;
};

/**
 * Seed for per-user randomization. Keyed on the acting user where there is one
 * so a member sees a stable order across devices, and on the persist key
 * otherwise so an anonymous draft stays stable across a reload.
 */
export function formRandomizationKey(args: RandomizationKeyArgs): string {
  const { formId, activeUserKey, persistKey } = args;
  const base = `form:${formId}`;
  if (activeUserKey) {
    return `${base}:user:${activeUserKey}`;
  }
  if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
    return `${base}:persist:${String(persistKey)}`;
  }
  return base;
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
