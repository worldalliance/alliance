import {
  collectVariableInputFields,
  isFieldGroup,
  isQuestionField,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type ListSubField,
  type PageItem,
} from "./form-schema";
import type { FormSchemaValidationError } from "./form-schema-validate";
import { evaluateVariable } from "./variable-evaluation";
import { compileVariableExpression } from "./variable-expression";
import { checkVariableFormulaType } from "./variable-formula-check";
import {
  isFieldKindReadableByFieldInput,
  isKnownFieldKind,
  listInputPropertyErrors,
  VARIABLE_NAME_REGEX,
  variableTypeEnv,
  type FormVariable,
} from "./variables";

type CollectedField = {
  kind: AnyField["kind"];
  // List sub-fields are collected so references to them are rejected as
  // unsupported rather than missing.
  insideList: boolean;
  subFields: readonly ListSubField[];
};

function collectFieldKinds(schema: FormSchema): Map<string, CollectedField> {
  const fields = new Map<string, CollectedField>();
  for (const page of schema.pages ?? []) {
    for (const item of page.fields ?? []) {
      collectFieldKindsFromItem(item, fields);
    }
  }
  return fields;
}

export function collectVariableErrors(
  schema: FormSchema,
  errors: FormSchemaValidationError[],
): void {
  const variables = schema.variables ?? [];
  const fieldKinds = collectFieldKinds(schema);
  const declared = new Set<string>();

  // An input the picker could never have offered reads as `any`, so
  // `checkVariableInputs` reports one focused error instead of the type checker
  // adding one per use.
  const readableFields = variableInputFieldsById(
    collectVariableInputFields(schema),
  );
  const unansweredContext = { answers: {}, fields: readableFields };

  for (const variable of variables) {
    const blockId = `variable:${variable.name}`;
    const push = (message: string) => errors.push({ blockId, message });

    if (!VARIABLE_NAME_REGEX.test(variable.name)) {
      push(
        `Variable name "${variable.name}" may use only letters, numbers, underscores and dashes`,
      );
    }
    if (declared.has(variable.name)) {
      push(`Duplicate variable name "${variable.name}"`);
    }
    declared.add(variable.name);

    const errorCountBeforeInputs = errors.length;
    checkVariableInputs(variable, fieldKinds, push);

    const compiled = compileVariableExpression(
      variable.formula,
      new Set(Object.keys(variable.inputs)),
    );
    if (!compiled.ok) {
      push(`Formula for "${variable.name}": ${compiled.error}`);
      continue;
    }

    const typed = checkVariableFormulaType(
      variable.formula,
      variableTypeEnv(variable, readableFields),
    );
    if (!typed.ok) {
      push(`Formula for "${variable.name}": ${typed.error}`);
      continue;
    }

    if (errors.length > errorCountBeforeInputs) continue;

    // Past the budget unanswered, it blocks the form for anyone yet to answer.
    const unanswered = evaluateVariable(variable, unansweredContext);
    if (!unanswered.ok) {
      push(`Formula for "${variable.name}": ${unanswered.error}`);
    }
  }
}

function checkVariableInputs(
  variable: FormVariable,
  fields: Map<string, CollectedField>,
  push: (message: string) => void,
): void {
  for (const [inputName, input] of Object.entries(variable.inputs)) {
    const topLevelField = (): CollectedField | undefined => {
      const field = fields.get(input.fieldId);
      if (field === undefined) {
        push(
          `Input "${inputName}" references missing field "${input.fieldId}"`,
        );
        return undefined;
      }
      if (field.insideList) {
        push(
          `Input "${inputName}" reads field "${input.fieldId}", which is inside a list. Read the whole list instead`,
        );
        return undefined;
      }
      return field;
    };
    const { kind } = input;
    switch (kind) {
      case "field": {
        const field = topLevelField();
        if (field === undefined) break;
        if (field.kind === "list") {
          push(
            `Input "${inputName}" reads list "${input.fieldId}" as a single field. Read it as a list input`,
          );
        } else if (!isKnownFieldKind(field.kind)) {
          push(
            `Input "${inputName}" reads field "${input.fieldId}", whose kind (${field.kind}) this build doesn't know. Reload the page`,
          );
        } else if (!isFieldKindReadableByFieldInput(field.kind)) {
          push(
            `Input "${inputName}" reads field "${input.fieldId}", whose kind (${field.kind}) has no value a formula can read`,
          );
        }
        break;
      }
      case "list": {
        const field = topLevelField();
        if (field === undefined) break;
        if (field.kind !== "list") {
          push(
            `Input "${inputName}" reads field "${input.fieldId}" as a list, but its kind is ${field.kind}`,
          );
          break;
        }
        for (const message of listInputPropertyErrors({
          inputName,
          input,
          subFields: field.subFields,
        })) {
          push(message);
        }
        break;
      }
      default:
        push(
          `Input "${inputName}" has a kind (${kind satisfies never}) this build doesn't know. Reload the page`,
        );
    }
  }
}

function collectFieldKindsFromItem(
  item: PageItem,
  fields: Map<string, CollectedField>,
): void {
  if (isFieldGroup(item)) {
    for (const child of item.fields) {
      collectFieldKindsFromItem(child, fields);
    }
    return;
  }
  if (!isQuestionField(item)) return;
  const subFields = item.kind === "list" ? (item.fields ?? []) : [];
  fields.set(item.id, { kind: item.kind, insideList: false, subFields });
  for (const sub of subFields) {
    fields.set(sub.id, { kind: sub.kind, insideList: true, subFields: [] });
  }
}
