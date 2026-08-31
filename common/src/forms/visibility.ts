import { type ZodError, z } from "zod";
import { R, type Result } from "../result";
import type { DeviceVisibilityTarget } from "./device";
import type { DisplayBlock } from "./display-blocks";
import {
  type AnyField,
  type FormValue,
  type OutputFieldBlock,
  type Page,
  isQuestionField,
} from "./form-schema";
import {
  type Condition,
  type VisibleIfFormula,
  evaluateVisibilityFormula,
} from "./visible-if-formula";

/** The verdict each visibility validator returned, keyed by validator id. */
export type VisibilityValidatorResults = Record<number, boolean>;

/**
 * A jsonb round trip turns the validator ids into string keys. An id is a
 * custom validator's row id, or the negative draft id an admin-built schema
 * keeps when the builder never resolved the draft to a saved validator.
 *
 * Matched, not coerced: `Number` reads `"0x10"` as 16 and `" 7 "` as 7, so two
 * keys could collapse onto one id, the later silently overwriting the earlier.
 */
const validatorIdSchema = z
  .string()
  .regex(/^-?\d+$/)
  .transform(Number);

export const visibilityValidatorResultsSchema = z.record(
  validatorIdSchema,
  z.boolean(),
);

const verdictEntrySchema = z.tuple([validatorIdSchema, z.boolean()]);

/**
 * Reads a stored blob: use this on the way out of storage, and the strict
 * schema above on the way in, where a caller can still be told to fix the
 * payload. Only a blob that isn't an object at all fails; an entry that isn't
 * an id keyed to a boolean is dropped and named in `unreadable`, so one
 * unreadable verdict doesn't discard the verdicts beside it.
 */
export function readVisibilityValidatorResults(
  value: unknown,
): Result<
  { verdicts: VisibilityValidatorResults; unreadable: string[] },
  ZodError
> {
  const blob = z.record(z.string(), z.unknown()).safeParse(value ?? {});
  if (!blob.success) {
    return R.failure(blob.error);
  }

  const verdicts: VisibilityValidatorResults = {};
  const unreadable: string[] = [];
  for (const entry of Object.entries(blob.data)) {
    const parsed = verdictEntrySchema.safeParse(entry);
    if (parsed.success) {
      const [validatorId, verdict] = parsed.data;
      verdicts[validatorId] = verdict;
    } else {
      unreadable.push(entry[0]);
    }
  }

  return R.success({ verdicts, unreadable });
}

export const hasContent = (value: FormValue | undefined): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
};

export type ConditionExtras = {
  deviceType: DeviceVisibilityTarget;
  visibilityValidatorResults?: VisibilityValidatorResults;
  fieldLookup?: Map<string, AnyField>;
  visibilityMemo?: Map<string, boolean>;
  visibilityEvaluationStack?: Set<string>;
  previousAnswerData?: Record<number, Record<string, unknown>>;
  outputBlockVisibility?: Map<string, boolean>;
  userHasCity?: boolean;
  /**
   * ISO datetime of the user's earliest `signed` contract event;
   * null/undefined when they have never signed.
   */
  firstContractSignedAt?: string | null;
  /**
   * How many distinct actions the user has completed; undefined is treated as
   * zero, matching the guest/never-completed evaluation.
   */
  completedActionCount?: number;
};

type ValueBasedCondition = Extract<
  Condition,
  { kind: "equals" | "includesOption" | "anySelected" | "hasValue" }
>;

function resolveConditionValue(
  cond: ValueBasedCondition,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): FormValue | undefined {
  if (cond.sourceFormId != null && extras.previousAnswerData) {
    return extras.previousAnswerData[cond.sourceFormId]?.[
      cond.when
    ] as FormValue;
  }
  return data[cond.when];
}

const evaluateValueBasedCondition = (
  cond: ValueBasedCondition,
  val: FormValue | undefined,
): boolean => {
  if (cond.kind === "hasValue") {
    const present = hasContent(val);
    return cond.hasValue ? present : !present;
  }
  if (cond.kind === "anySelected") {
    const selections = Array.isArray(val) ? val : [];
    return cond.anySelected ? selections.length > 0 : selections.length === 0;
  }
  if (cond.kind === "includesOption") {
    if (!cond.includesOption) {
      return false;
    }
    return (
      Array.isArray(val) &&
      val.every((e) => typeof e === "string") &&
      (val as string[]).includes(cond.includesOption)
    );
  }
  const equals = cond.equals;
  if (typeof equals === "boolean") {
    if (val === undefined || val === null) {
      return false;
    }
    return val === equals;
  }
  if (typeof equals === "number" && Number.isFinite(equals)) {
    if (val === "" || val === undefined || val === null) {
      return false;
    }
    if (typeof val === "number" && Number.isFinite(val)) {
      return val === equals;
    }
    if (typeof val === "string" && val.trim() !== "") {
      const n = Number(val);
      return Number.isFinite(n) && n === equals;
    }
    return false;
  }
  if (Array.isArray(val) && equals !== null && equals !== undefined) {
    return (
      Array.isArray(val) &&
      val.every((e) => typeof e === "string") &&
      (val as string[]).includes(equals as string)
    );
  }
  return val === equals;
};

export function evaluateCondition(
  cond: Condition,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): boolean {
  switch (cond.kind) {
    case "deviceType":
      if (!Array.isArray(cond.deviceType) || cond.deviceType.length === 0) {
        return false;
      }
      return cond.deviceType.includes(extras.deviceType);
    case "validator": {
      const expected = cond.resultEquals ?? true;
      const actual = extras.visibilityValidatorResults?.[cond.validatorId];
      if (actual === undefined) {
        return false;
      }
      return actual === expected;
    }
    case "outputBlockVisible": {
      const expected = cond.isVisible ?? true;
      const actual =
        extras.outputBlockVisibility?.get(cond.outputBlockVisible) ?? true;
      return actual === expected;
    }
    case "userHasCity": {
      const present = extras.userHasCity ?? false;
      return cond.userHasCity ? present : !present;
    }
    case "firstContractSigned": {
      if (!extras.firstContractSignedAt) {
        return false;
      }
      const signedAt = Date.parse(extras.firstContractSignedAt);
      const threshold = Date.parse(cond.date);
      if (Number.isNaN(signedAt) || Number.isNaN(threshold)) {
        return false;
      }
      switch (cond.comparison) {
        case "before":
          return signedAt < threshold;
        case "onOrAfter":
          return signedAt >= threshold;
        default:
          cond.comparison satisfies never;
          return false;
      }
    }
    case "completedActionCount":
      return (extras.completedActionCount ?? 0) >= cond.atLeast;
    case "equals":
    case "includesOption":
    case "anySelected":
    case "hasValue": {
      const val = resolveConditionValue(cond, data, extras);
      return evaluateValueBasedCondition(cond, val);
    }
    default:
      // callers that must not guess reject the whole schema first
      // (`findUnknownConditionKind` in the renderers,
      // `assertConditionKindsSupported` on submit).
      cond satisfies never;
      return false;
  }
}

/**
 * Whether a field must be answered. A conditional rule replaces the static
 * `required` flag when present, and is evaluated against the same answers and
 * extras as visibility — so callers must pass the same context they use for
 * `isElementCurrentlyVisible`, and a schema whose requiredness depends on the
 * viewer's visibility context has to fetch it (see
 * `schemaNeedsVisibilityContext`).
 *
 * A `requiredIfFormula` replaces `required` rather than adding to it, so it can
 * make a statically-required field optional as well as the other way round.
 */
export function isFieldConditionallyRequired(
  field: AnyField,
  data: Record<string, FormValue>,
  extras: ConditionExtras,
): boolean {
  if (hasEvaluableFormula(field.requiredIfFormula)) {
    return evaluateVisibleIfFormula(field.requiredIfFormula, data, extras);
  }
  return !!field.required;
}

function hasEvaluableFormula(
  formula: VisibleIfFormula | undefined,
): formula is VisibleIfFormula {
  return !!(
    formula?.conditions &&
    Object.keys(formula.conditions).length > 0 &&
    formula.formula
  );
}

export function isElementCurrentlyVisible(
  element: AnyField | DisplayBlock | OutputFieldBlock,
  data: Record<string, FormValue>,
  extras: ConditionExtras & { readOnly?: boolean },
): boolean {
  const formula = element.visibleIfFormula;
  if (!hasEvaluableFormula(formula)) {
    return true;
  }
  if (extras.readOnly && element.id) {
    const existing = data[element.id];
    if (existing !== undefined && existing !== null) {
      return true;
    }
  }
  return evaluateVisibleIfFormula(formula, data, extras);
}

/**
 * A page with a `visibleIfFormula` is skipped entirely (rendering, navigation,
 * validation) when the formula evaluates false. Pages without one are always
 * visible.
 */
export function isPageCurrentlyVisible(
  page: Page,
  data: Record<string, FormValue>,
  extras: ConditionExtras & { readOnly?: boolean },
): boolean {
  const formula = page.visibleIfFormula;
  if (!hasEvaluableFormula(formula)) {
    return true;
  }
  // Read-only fallback, mirroring isElementCurrentlyVisible: conditions don't
  // always replay when reviewing a completed response (e.g. validator results
  // missing from older submissions), so never hide a page the user answered.
  if (extras.readOnly) {
    const anyFieldAnswered = page.fields.some(
      (field) => isQuestionField(field) && hasContent(data[field.id]),
    );
    if (anyFieldAnswered) {
      return true;
    }
  }
  return evaluateVisibleIfFormula(formula, data, extras);
}

/**
 * Returns `answers` without the entries for question fields the user cannot
 * currently see — because the field's own formula is false or because its page
 * is hidden. An answer that isn't visible is treated as never given: it must
 * not drive visibility conditions, satisfy validation, or be persisted.
 *
 * Runs to a fixpoint, since removing a stale answer can hide further pages and
 * fields (or, with negated conditions, reveal fields — those stay stripped,
 * because the user never answered them in a visible state). Keys that don't
 * belong to any question field are left untouched. Returns `answers` itself
 * when nothing is stripped.
 */
export function stripHiddenAnswers(
  pages: Page[],
  answers: Record<string, FormValue>,
  extras: ConditionExtras & { readOnly?: boolean },
): Record<string, FormValue> {
  const fieldLookup =
    extras.fieldLookup ??
    new Map(
      pages.flatMap((page) =>
        page.fields
          .filter(isQuestionField)
          .map((field) => [field.id, field] as const),
      ),
    );

  let data = answers;
  for (;;) {
    // Fresh memo per pass: `data` shrinks between passes, so cached visibility
    // results from a previous pass may no longer hold.
    const passExtras = {
      ...extras,
      fieldLookup,
      visibilityMemo: new Map<string, boolean>(),
      visibilityEvaluationStack: new Set<string>(),
    };
    const hiddenAnsweredIds = pages.flatMap((page) => {
      const pageVisible = isPageCurrentlyVisible(page, data, passExtras);
      return page.fields
        .filter(isQuestionField)
        .filter((field) => field.id in data)
        .filter(
          (field) =>
            !pageVisible || !isElementCurrentlyVisible(field, data, passExtras),
        )
        .map((field) => field.id);
    });
    if (hiddenAnsweredIds.length === 0) {
      return data;
    }
    data = { ...data };
    for (const id of hiddenAnsweredIds) {
      delete data[id];
    }
  }
}

function evaluateVisibleIfFormula(
  formula: VisibleIfFormula,
  data: Record<string, FormValue>,
  extras: ConditionExtras & { readOnly?: boolean },
): boolean {
  const visibilityMemo = extras.visibilityMemo ?? new Map<string, boolean>();
  const visibilityEvaluationStack =
    extras.visibilityEvaluationStack ?? new Set<string>();

  const isReferencedFieldVisible = (fieldId: string): boolean => {
    const fieldLookup = extras.fieldLookup;
    if (!fieldLookup) {
      return true;
    }

    const memoized = visibilityMemo.get(fieldId);
    if (memoized !== undefined) {
      return memoized;
    }

    const referencedField = fieldLookup.get(fieldId);
    if (!referencedField) {
      return true;
    }

    // Cyclic dependencies fall back to legacy value-only behavior.
    if (visibilityEvaluationStack.has(fieldId)) {
      return true;
    }

    visibilityEvaluationStack.add(fieldId);
    const visible = isElementCurrentlyVisible(referencedField, data, {
      ...extras,
      visibilityMemo,
      visibilityEvaluationStack,
    });
    visibilityEvaluationStack.delete(fieldId);
    visibilityMemo.set(fieldId, visible);
    return visible;
  };

  const resolveValue = (cond: ValueBasedCondition): FormValue | undefined => {
    if (cond.sourceFormId != null && extras.previousAnswerData) {
      return extras.previousAnswerData[cond.sourceFormId]?.[
        cond.when
      ] as FormValue;
    }
    return isReferencedFieldVisible(cond.when) ? data[cond.when] : undefined;
  };

  const results: Record<string, boolean> = {};
  for (const [name, cond] of Object.entries(formula.conditions)) {
    switch (cond.kind) {
      case "deviceType":
      case "validator":
      case "outputBlockVisible":
      case "userHasCity":
      case "firstContractSigned":
      case "completedActionCount":
        results[name] = evaluateCondition(cond, data, extras);
        break;
      case "equals":
      case "includesOption":
      case "anySelected":
      case "hasValue": {
        const value = resolveValue(cond);
        results[name] = evaluateValueBasedCondition(cond, value);
        break;
      }
      default:
        // Unknown kind — not met, for the reasons on `evaluateCondition`'s
        // default.
        cond satisfies never;
        results[name] = false;
        break;
    }
  }
  return evaluateVisibilityFormula(formula.formula, results);
}
