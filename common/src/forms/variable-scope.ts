import {
  collectVariableInputFields,
  readableVariableInputFields,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
} from "./form-schema";
import { mapOptionsFormulas } from "./formula-options";
import { syncFormulaListInputs, type VariableFieldScope } from "./variables";

/**
 * Page-level question fields of each form a variable or options formula reads,
 * by form id.
 */
export type SourceFormFields = ReadonlyMap<number, readonly AnyField[]>;

export function variableFieldScope(
  schema: FormSchema,
  sourceForms: SourceFormFields,
): VariableFieldScope {
  return {
    fields: variableInputFieldsById(collectVariableInputFields(schema)),
    sourceFields: new Map(
      [...sourceForms].map(([formId, fields]) => [
        formId,
        variableInputFieldsById(readableVariableInputFields(fields)),
      ]),
    ),
  };
}

/** Returns `schema` itself when every list input is already in sync. */
export function syncSchemaListInputs(
  schema: FormSchema,
  sourceForms: SourceFormFields,
): FormSchema {
  const scope = variableFieldScope(schema, sourceForms);
  const current = schema.variables;
  const variables = current?.map((variable) =>
    syncFormulaListInputs(variable, scope),
  );
  const withVariables =
    variables === undefined ||
    variables.every((variable, index) => variable === current?.[index])
      ? schema
      : { ...schema, variables };
  return mapOptionsFormulas(withVariables, (formula) =>
    syncFormulaListInputs(formula, scope),
  );
}
