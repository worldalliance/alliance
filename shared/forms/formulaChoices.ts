import type { FormSchema } from "@alliance/common/forms/form-schema";
import { schemaWithSavedChoices } from "@alliance/common/forms/formula-options";
import { parseFormulaChoices } from "../parsed-dtos";

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
