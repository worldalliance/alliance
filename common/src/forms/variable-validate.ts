import {
  isFieldGroup,
  isQuestionField,
  type AnyField,
  type FormSchema,
  type ListSubField,
  type PageItem,
} from "./form-schema";
import type {
  FormSchemaValidationContext,
  FormSchemaValidationError,
} from "./form-schema-validate";
import { evaluateVariable } from "./variable-evaluation";
import { compileVariableExpression } from "./variable-expression";
import { checkVariableFormulaType } from "./variable-formula-check";
import { inputSourceFormId } from "./variable-inputs";
import { variableFieldScope } from "./variable-scope";
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

function collectFieldKinds(
  items: readonly PageItem[],
): Map<string, CollectedField> {
  const fields = new Map<string, CollectedField>();
  for (const item of items) collectFieldKindsFromItem(item, fields);
  return fields;
}

export function collectVariableErrors(
  schema: FormSchema,
  context: FormSchemaValidationContext,
  errors: FormSchemaValidationError[],
): void {
  const variables = schema.variables ?? [];
  const fieldKinds: FieldKindScope = {
    fields: collectFieldKinds(
      (schema.pages ?? []).flatMap((page) => page.fields ?? []),
    ),
    sourceFields: new Map(
      [...context.sourceForms].map(([formId, fields]) => [
        formId,
        collectFieldKinds(fields),
      ]),
    ),
    formId: context.formId,
  };
  const declared = new Set<string>();

  // An input the picker could never have offered reads as `any`, so
  // `checkVariableInputs` reports one focused error instead of the type checker
  // adding one per use.
  const readableFields = variableFieldScope(schema, context.sourceForms);
  const unansweredContext = {
    answers: {},
    fields: readableFields.fields,
    sources: new Map(
      [...readableFields.sourceFields].map(([formId, fields]) => [
        formId,
        { fields, responses: [] },
      ]),
    ),
  };

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

type FieldKindScope = {
  fields: Map<string, CollectedField>;
  sourceFields: Map<number, Map<string, CollectedField>>;
  formId: number | undefined;
};

function checkVariableInputs(
  variable: FormVariable,
  scope: FieldKindScope,
  push: (message: string) => void,
): void {
  for (const [inputName, input] of Object.entries(variable.inputs)) {
    const sourceFormId = inputSourceFormId(input);
    if (sourceFormId !== undefined && sourceFormId === scope.formId) {
      push(
        `Input "${inputName}" reads this form as another form. Pick "This form" instead`,
      );
      continue;
    }
    const fields =
      sourceFormId === undefined
        ? scope.fields
        : scope.sourceFields.get(sourceFormId);
    if (fields === undefined) {
      push(
        `Input "${inputName}" reads form ${sourceFormId}, which doesn't exist or couldn't be loaded`,
      );
      continue;
    }
    const topLevelField = (): CollectedField | undefined => {
      if (input.fieldId === "") {
        push(`Input "${inputName}" has no question picked`);
        return undefined;
      }
      const field = fields.get(input.fieldId);
      if (field === undefined) {
        push(
          sourceFormId === undefined
            ? `Input "${inputName}" references missing field "${input.fieldId}"`
            : `Input "${inputName}" references field "${input.fieldId}", which form ${sourceFormId} no longer has`,
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
      case "field":
      case "sourceField": {
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
      case "list":
      case "sourceList": {
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
