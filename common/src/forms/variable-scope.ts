import {
  collectVariableInputFields,
  readableVariableInputFields,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
} from "./form-schema";
import { syncVariableListInputs, type VariableFieldScope } from "./variables";

/**
 * Page-level question fields of each form a variable or options formula reads,
 * by form id, with groups flattened as `collectVariableResolutionFields` does.
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
export function syncSchemaVariableListInputs(
  schema: FormSchema,
  sourceForms: SourceFormFields,
): FormSchema {
  const current = schema.variables;
  if (current === undefined) return schema;
  const variables = syncVariableListInputs(
    current,
    variableFieldScope(schema, sourceForms),
  );
  return variables.every((variable, index) => variable === current[index])
    ? schema
    : { ...schema, variables };
}
