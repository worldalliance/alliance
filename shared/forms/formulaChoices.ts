import {
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListSubField,
} from "@alliance/common/forms/form-schema";
import {
  FORMULA_SOURCES_CHANGED,
  isFormulaChoiceField,
  keepAvailableChoices,
  optionsFormulaSourceFormIds,
  resolveFormulaOptions,
  schemaWithSavedChoices,
  type ResolvedFormulaOptions,
} from "@alliance/common/forms/formula-options";
import type { VariableResolutionContext } from "@alliance/common/forms/variable-evaluation";
import {
  stripHiddenAnswers,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import type { Result } from "@alliance/common/result";
import type { FormulaSourceDto, HeyApiError } from "../client";
import { parseFormulaChoices } from "../parsed-dtos";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";

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
