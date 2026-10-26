/**
 * The headless half of the form renderer, shared by the web and native
 * renderers. Everything here is state, derivation and IO; anything that reads
 * `window` or returns an element stays in the platform component.
 */

import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { type DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  collectVariableResolutionFields,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListSubField,
} from "@alliance/common/forms/form-schema";
import {
  NO_OPTIONS,
  schemaWithResolvedOptions,
  type ResolvedOptions,
} from "@alliance/common/forms/formula-options";
import {
  emptyUserPropertyPresence,
  type UserPropertyPresence,
} from "@alliance/common/forms/user-properties";
import {
  aggregateSourceKey,
  variableAggregateSources,
} from "@alliance/common/forms/variable-aggregates";
import { resolveVariableValues } from "@alliance/common/forms/variable-evaluation";
import { EMPTY_HISTORY } from "@alliance/common/forms/variable-source-history";
import { variableHistoryFormIds } from "@alliance/common/forms/variables";
import {
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  isFieldConditionallyRequired,
  listRowData,
  visibleListSubFields,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import { useCallback, useEffect, useMemo } from "react";
import {
  formRandomizationKey,
  getFallbackVisiblePageIndex,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  getVisiblePageIndices,
  type RandomizationKeyArgs,
} from "./formrenderer";
import { validateFieldValue as validateFieldValueShared } from "./forms/fieldValidation";
import {
  useDropUnofferedChoices,
  useOfferedChoicesFor,
  visibleOfferedAnswers,
} from "./forms/formulaChoices";
import {
  evaluatedAggregates,
  type VariableAggregates,
} from "./forms/useVariableAggregates";
import {
  evaluatedSources,
  type SourceHistories,
} from "./forms/useVariableSourceHistories";
import { referencedValidatorIds } from "./forms/useVisibilityValidatorResults";

export function useRandomizationKey(args: RandomizationKeyArgs): string {
  const { formId, activeUserKey, persistKey } = args;
  return useMemo(
    () => formRandomizationKey({ formId, activeUserKey, persistKey }),
    [formId, activeUserKey, persistKey],
  );
}

export type FieldConditionContext = {
  isFieldRequired: (field: AnyField) => boolean;
  forRow: (cells: Record<string, FormValue>) => ListRowContext;
};

/** A row's cells shadow the form's answers. */
export type ListRowContext = FieldConditionContext & {
  visibleSubFields: (subFields: ListSubField[]) => ListSubField[];
};

/** For a renderer with no answers to read. */
export const staticFieldContext: ListRowContext = {
  isFieldRequired: (field) => !!field.required,
  visibleSubFields: (subFields) => subFields,
  forRow: () => staticFieldContext,
};

function fieldContextFor(params: {
  data: Record<string, FormValue>;
  extras: ConditionExtras & { readOnly?: boolean };
}): FieldConditionContext {
  const { data, extras } = params;
  return {
    // Reads the same answers as `validateFieldValue`, so a required marker on
    // the label agrees with what blocks submission and with the server's check.
    isFieldRequired: (field) =>
      isFieldConditionallyRequired(field, data, extras),
    forRow: (cells) => ({
      ...fieldContextFor({
        data: listRowData({ data, row: cells }),
        extras,
      }),
      visibleSubFields: (subFields) =>
        visibleListSubFields({
          subFields,
          data,
          row: cells,
          extras,
        }),
    }),
  };
}

/** Each input visibility reads, set while it loads or after it fails. */
export type VisibilityInputsPending = {
  visibilityContextLoading: boolean;
  visibilityContextFailed: boolean;
  visibilityValidatorsFailed: boolean;
  userLoading: boolean;
  previousAnswersPending: boolean;
};

export type FormVisibility = {
  visibilityExtras: ConditionExtras;
  effectiveFormData: Record<string, FormValue>;
  variableValues: ReadonlyMap<string, string>;
  /** Set when any variable or options formula fails, which blocks the whole form. */
  variablesError: string | null;
  /** Apply to a field with `withResolvedOptions` before rendering it. */
  resolvedOptions: ResolvedOptions;
  isElementCurrentlyVisible: (element: AnyField | DisplayBlock) => boolean;
  fieldContext: FieldConditionContext;
  visiblePageIndices: number[];
  nextVisiblePageIndex: number | null;
  previousVisiblePageIndex: number | null;
  /**
   * False while an input a condition reads is loading or failed, so which
   * pages are visible, and where Next goes, may still change.
   */
  visibilitySettled: boolean;
  validateFieldValue: (
    field: AnyField,
    fieldValue: FormValue | undefined,
    data?: Record<string, FormValue>,
  ) => string | null;
};

/**
 * Everything downstream of "which answers count right now". Answers to fields
 * the user cannot currently see, and selections an options formula doesn't
 * offer, are stripped before visibility, validation, rendering and submission
 * read them, so what the user sees is exactly what submits. Raw `formData`
 * keeps hidden answers, so re-showing a field restores what was typed, and
 * loses a selection only once its options formula stops offering it.
 *
 * Also nudges `currentPageIndex` to the nearest visible page when an answer
 * hides the page the user is on, once `visibilitySettled`, and drops
 * unoffered selections from `formData`, so `setCurrentPageIndex` and
 * `setFormData` must be referentially stable. Pass `useState` setters, or
 * `useCallback`s.
 */
export function useFormVisibility(args: {
  schema: FormSchema;
  formData: Record<string, FormValue>;
  setFormData: (
    update: (prev: Record<string, FormValue>) => Record<string, FormValue>,
  ) => void;
  readOnly: boolean;
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
  effectiveDeviceType: DeviceVisibilityTarget;
  visibilityValidatorResults: Record<number, boolean>;
  fieldLookup: Map<string, AnyField>;
  previousAnswerData: ConditionExtras["previousAnswerData"];
  sourceHistories: SourceHistories;
  variableAggregates: VariableAggregates;
  /** From `useRandomizationKey`; seeds the variables' `random` inputs. */
  randomizationKey: string;
  userHasCity: boolean;
  userPropertyHasValue?: UserPropertyPresence;
  firstContractSignedAt: string | null;
  completedActionCount: number;
  /**
   * Selections drop only once none of these is set. Verdicts not yet requested
   * are read from `visibilityValidatorResults`.
   */
  visibilityInputs: VisibilityInputsPending;
}): FormVisibility {
  const {
    schema,
    formData,
    setFormData,
    readOnly,
    currentPageIndex,
    setCurrentPageIndex,
    effectiveDeviceType,
    visibilityValidatorResults,
    fieldLookup,
    previousAnswerData,
    sourceHistories,
    variableAggregates,
    randomizationKey,
    userHasCity,
    userPropertyHasValue,
    firstContractSignedAt,
    completedActionCount,
    visibilityInputs,
  } = args;

  // The single source of the account/device/validator state every visibility
  // and requiredness evaluation reads. Built once so a new condition kind is
  // added here rather than at each call site. Miss one and it would silently
  // evaluate against the guest default, since every key is optional.
  const visibilityExtras = useMemo<ConditionExtras>(
    () => ({
      deviceType: effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      userPropertyHasValue: userPropertyHasValue ?? emptyUserPropertyPresence(),
      firstContractSignedAt,
      completedActionCount,
    }),
    [
      effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      userPropertyHasValue,
      firstContractSignedAt,
      completedActionCount,
    ],
  );

  // `readOnly` isn't part of `ConditionExtras`. Only the element/page
  // visibility helpers take it, to treat a completed form's fields as visible.
  const visibilityExtrasReadOnly = useMemo(
    () => ({ ...visibilityExtras, readOnly }),
    [visibilityExtras, readOnly],
  );

  // Only a read-only form draws past a deleted source form. A formula reading
  // one resolves as if it had no submissions, which the builder's save already
  // requires every options formula to handle.
  const optionsSources = useMemo(() => {
    const { sources, deletedFormIds } = evaluatedSources(sourceHistories);
    return deletedFormIds.size === 0
      ? sources
      : new Map([
          ...sources,
          ...[...deletedFormIds].map((id) => [id, EMPTY_HISTORY] as const),
        ]);
  }, [sourceHistories]);
  const visibleOffered = useMemo(
    () =>
      visibleOfferedAnswers({
        schema,
        answers: formData,
        extras: visibilityExtrasReadOnly,
        sources: optionsSources,
      }),
    [schema, formData, visibilityExtrasReadOnly, optionsSources],
  );
  const formulaOptions = visibleOffered.resolved;
  const resolvedOptions = formulaOptions.ok
    ? formulaOptions.value.options
    : NO_OPTIONS;
  const verdictsPending = useMemo(
    () =>
      referencedValidatorIds(schema).some(
        (id) => !(id in visibilityValidatorResults),
      ),
    [schema, visibilityValidatorResults],
  );
  const visibilitySettled =
    !Object.values(visibilityInputs).some(Boolean) && !verdictsPending;
  const offeredChoicesFor = useOfferedChoicesFor({
    schema,
    extras: visibilityExtrasReadOnly,
    historiesStatus: sourceHistories.status,
    sources: optionsSources,
    inputsSettled: visibilitySettled,
  });
  useDropUnofferedChoices({
    schema,
    readOnly,
    formData,
    offeredChoicesFor,
    setFormData,
  });
  const effectiveFormData = visibleOffered.answers;

  const variableInputFields = useMemo(
    () =>
      variableInputFieldsById(
        collectVariableResolutionFields(
          schemaWithResolvedOptions(schema, resolvedOptions),
        ),
      ),
    [schema, resolvedOptions],
  );

  const variables = useMemo(() => {
    const { sources, deletedFormIds } = evaluatedSources(sourceHistories);
    const aggregates = evaluatedAggregates(variableAggregates);
    // A variable reading a deleted form or question stays out, so its
    // `#{name}` shows as written, the way shared output leaves a variable it
    // can't resolve.
    const resolvable = schema.variables?.filter(
      (variable) =>
        variableHistoryFormIds([variable]).every(
          (id) => !deletedFormIds.has(id),
        ) &&
        variableAggregateSources([variable]).every((source) =>
          aggregates.has(aggregateSourceKey(source)),
        ),
    );
    return resolveVariableValues(resolvable, {
      answers: effectiveFormData,
      fields: variableInputFields,
      sources,
      aggregates,
      randomizationKey,
    });
  }, [
    schema.variables,
    effectiveFormData,
    variableInputFields,
    sourceHistories,
    variableAggregates,
    randomizationKey,
  ]);

  const isElementCurrentlyVisible = useCallback(
    (element: AnyField | DisplayBlock): boolean =>
      isElementCurrentlyVisibleShared(
        element,
        effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [effectiveFormData, visibilityExtrasReadOnly],
  );

  const fieldContext = useMemo(
    () =>
      fieldContextFor({
        data: effectiveFormData,
        extras: visibilityExtrasReadOnly,
      }),
    [effectiveFormData, visibilityExtrasReadOnly],
  );

  const visiblePageIndices = useMemo(
    () =>
      getVisiblePageIndices(
        schema.pages ?? [],
        effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [schema.pages, effectiveFormData, visibilityExtrasReadOnly],
  );

  const nextVisiblePageIndex = useMemo(
    () => getNextVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  const previousVisiblePageIndex = useMemo(
    () => getPreviousVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  useEffect(() => {
    if (!visibilitySettled) return;
    const fallback = getFallbackVisiblePageIndex(
      visiblePageIndices,
      currentPageIndex,
    );
    if (fallback !== null) {
      setCurrentPageIndex(fallback);
    }
  }, [
    visibilitySettled,
    visiblePageIndices,
    currentPageIndex,
    setCurrentPageIndex,
  ]);

  const validateFieldValue = useCallback(
    (
      field: AnyField,
      fieldValue: FormValue | undefined,
      data?: Record<string, FormValue>,
    ): string | null =>
      validateFieldValueShared(
        field,
        fieldValue,
        data ?? effectiveFormData,
        visibilityExtras,
      ),
    [effectiveFormData, visibilityExtras],
  );

  return {
    visibilityExtras,
    effectiveFormData,
    variableValues: variables.ok ? variables.value : new Map(),
    variablesError: formulaOptions.ok
      ? variables.ok
        ? null
        : variables.error
      : formulaOptions.error,
    resolvedOptions,
    isElementCurrentlyVisible,
    fieldContext,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validateFieldValue,
  };
}
