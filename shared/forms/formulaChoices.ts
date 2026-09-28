import {
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListSubField,
} from "@alliance/common/forms/form-schema";
import {
  collectOptionsFormulaFields,
  FORMULA_SOURCES_CHANGED,
  isFormulaChoiceField,
  keepAvailableChoices,
  optionsFormulaSourceFormIds,
  resolveFormulaOptions,
  schemaWithSavedChoices,
  type ResolvedFormulaOptions,
  type ResolvedOptions,
} from "@alliance/common/forms/formula-options";
import type { VariableResolutionContext } from "@alliance/common/forms/variable-evaluation";
import {
  stripHiddenAnswers,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import type { Result } from "@alliance/common/result";
import { useEffect, useMemo } from "react";
import type { FormulaSourceDto, HeyApiError } from "../client";
import { parseFormulaChoices } from "../parsed-dtos";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";

export type OfferedChoicesFor = (
  answers: Record<string, FormValue>,
) => ResolvedOptions | undefined;

// Selections are dropped for good, so only once no history can still arrive.
// A deleted source hides an editable form behind an alert, where dropping
// would only erase its draft.
const HISTORIES_SETTLED: Record<SourceHistoriesStatus, boolean> = {
  [SourceHistoriesStatus.Loading]: false,
  [SourceHistoriesStatus.Failed]: false,
  [SourceHistoriesStatus.SourceDeleted]: false,
  [SourceHistoriesStatus.Ready]: true,
};

/** Undefined, so nothing is dropped, until every input has settled. */
export function useOfferedChoicesFor(params: {
  schema: FormSchema;
  extras: ConditionExtras & { readOnly?: boolean };
  historiesStatus: SourceHistoriesStatus;
  /** The histories the screen offers choices from. */
  sources: VariableResolutionContext["sources"];
  /** Every visibility input and validator verdict has arrived. */
  inputsSettled: boolean;
}): OfferedChoicesFor | undefined {
  const { schema, extras, historiesStatus, sources, inputsSettled } = params;
  const hasOptionsFormulas = useMemo(
    () => collectOptionsFormulaFields(schema).length > 0,
    [schema],
  );
  return useMemo(() => {
    if (
      !hasOptionsFormulas ||
      !inputsSettled ||
      !HISTORIES_SETTLED[historiesStatus]
    ) {
      return undefined;
    }
    return (answers) => offeredChoices({ schema, answers, extras, sources });
  }, [
    hasOptionsFormulas,
    inputsSettled,
    historiesStatus,
    schema,
    extras,
    sources,
  ]);
}

/**
 * Drops, from the answers themselves, selections an options formula stopped
 * offering, so the choice stays gone if the formula offers it again. What's
 * offered is worked out from the answers being edited, so a restore landing
 * in the same commit is checked against its own answers.
 */
export function useDropUnofferedChoices(params: {
  schema: FormSchema;
  readOnly: boolean;
  formData: Record<string, FormValue>;
  offeredChoicesFor: OfferedChoicesFor | undefined;
  setFormData: (
    update: (prev: Record<string, FormValue>) => Record<string, FormValue>,
  ) => void;
}): void {
  const { schema, readOnly, formData, offeredChoicesFor, setFormData } = params;
  useEffect(() => {
    if (readOnly || offeredChoicesFor === undefined) return;
    setFormData((prev) => {
      const options = offeredChoicesFor(prev);
      return options === undefined
        ? prev
        : keepAvailableChoices({ schema, answers: prev, options });
    });
  }, [schema, readOnly, formData, offeredChoicesFor, setFormData]);
}

/**
 * The choices a selection may keep: those the formulas offer against every
 * answer, hidden ones included, so a selection survives while the answer
 * offering it is hidden, and those they offer against the visible answers,
 * so a choice offered only while an input is hidden can be picked. Undefined
 * when either fails, since one failing formula fails them all.
 */
export function offeredChoices(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  extras: ConditionExtras & { readOnly?: boolean };
  sources: VariableResolutionContext["sources"];
}): ResolvedOptions | undefined {
  const { schema, answers, sources } = params;
  const all = resolveFormulaOptions({ schema, answers, sources });
  const visible = visibleOfferedAnswers(params).resolved;
  if (!all.ok || !visible.ok) return undefined;
  return new Map(
    [...all.value.options].map(([fieldId, options]) => [
      fieldId,
      [...options, ...(visible.value.options.get(fieldId) ?? [])],
    ]),
  );
}

/**
 * The answers the member can see, without selections the options formulas
 * don't offer, and those formulas' options. Visibility and offered choices
 * each depend on the other, so they're settled together: a selection dropped
 * can show or hide other questions, and answers only drop, so this ends.
 */
export function visibleOfferedAnswers(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  extras: ConditionExtras & { readOnly?: boolean };
  sources: VariableResolutionContext["sources"];
}): {
  answers: Record<string, FormValue>;
  resolved: Result<ResolvedFormulaOptions, string>;
} {
  const { schema, extras, sources } = params;
  let answers = params.answers;
  for (;;) {
    const visible = stripHiddenAnswers(schema.pages ?? [], answers, extras);
    const resolved = resolveFormulaOptions({
      schema,
      answers: visible,
      sources,
    });
    if (!resolved.ok) return { answers: visible, resolved };
    // A stripped selection's options came from answers without it, so it
    // waits for the pass that shows it.
    const offered = keepAvailableChoices({
      schema,
      answers,
      options: resolved.value.options,
      visible,
    });
    if (offered === answers) {
      return { answers: resolved.value.answers, resolved };
    }
    answers = offered;
  }
}

/** A choice field whose formula resolved to no options, shown disabled. */
export function offersNoOptions(field: AnyField | ListSubField): boolean {
  return isFormulaChoiceField(field) && field.options.length === 0;
}

/**
 * The responses each options formula read, for the server to check against.
 * Until every history has loaded the form read none, so this names none.
 */
export function formulaSourcesFor(
  schema: FormSchema,
  histories: SourceHistories,
): FormulaSourceDto[] | undefined {
  if (histories.status !== SourceHistoriesStatus.Ready) return undefined;
  return optionsFormulaSourceFormIds(schema).map((formId) => ({
    formId,
    responseIds: (histories.sources.get(formId)?.responses ?? []).map(
      ({ id }) => id,
    ),
  }));
}

/**
 * A completed response's form, with the choices it saved in place of options
 * formulas, which it reads without their inputs.
 */
export function completedFormSchema(
  schema: FormSchema,
  completed: { formulaChoices: unknown } | undefined,
): FormSchema {
  return completed === undefined
    ? schema
    : schemaWithSavedChoices(
        schema,
        parseFormulaChoices(completed.formulaChoices),
      );
}

export type SubmitResult = { response: Response; error?: HeyApiError };

/**
 * Whether the server refused because the histories the form's options read
 * changed after it loaded them, which retrying can't fix.
 */
export function formulaSourcesChanged(result: SubmitResult): boolean {
  return (
    result.response.status === 409 &&
    result.error?.message === FORMULA_SOURCES_CHANGED
  );
}
