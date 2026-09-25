import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  FORMULA_SOURCES_CHANGED,
  optionsFormulaSourceFormIds,
  schemaWithSavedChoices,
} from "@alliance/common/forms/formula-options";
import type { FormulaSourceDto, HeyApiError } from "../client";
import { parseFormulaChoices } from "../parsed-dtos";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";

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
