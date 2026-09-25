import type { Result } from "../result";
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
import {
  collectOptionsFormulaFields,
  evaluateOptionsFormula,
  optionsCycleMessage,
  optionsFormulaOrder,
} from "./formula-options";
import { storedQuestionFields } from "./stored-schema";
import {
  aggregateSourceKey,
  variableAggregateSources,
} from "./variable-aggregates";
import {
  evaluateVariable,
  type VariableResolutionContext,
} from "./variable-evaluation";
import { compileVariableExpression } from "./variable-expression";
import {
  checkOptionsFormulaType,
  checkVariableFormulaType,
} from "./variable-formula-check";
import { inputSourceFormId, isSourceInput } from "./variable-inputs";
import { variableFieldScope, type SourceFormFields } from "./variable-scope";
import {
  isFieldKindReadableByFieldInput,
  isKnownFieldKind,
  listInputPropertyErrors,
  VARIABLE_NAME_REGEX,
  variableTypeEnv,
  type Formula,
  type VariableFieldScope,
} from "./variables";

type CollectedField = {
  kind: AnyField["kind"];
  // List sub-fields are collected so references to them are rejected as
  // unsupported rather than missing.
  insideList: boolean;
  subFields: readonly ListSubField[];
  optionsFromFormula: boolean;
};

function collectFieldKinds(
  items: readonly PageItem[],
): Map<string, CollectedField> {
  const fields = new Map<string, CollectedField>();
  for (const item of items) collectFieldKindsFromItem(item, fields);
  return fields;
}

/**
 * A form reading its own answers is checked against the schema being saved,
 * not the stored version it replaces.
 */
function withOwnFields(
  schema: FormSchema,
  context: FormSchemaValidationContext,
): SourceFormFields {
  const { formId, sourceForms } = context;
  if (formId === undefined) return sourceForms;
  const merged = new Map(sourceForms);
  const own = storedQuestionFields(schema);
  if (own.ok) merged.set(formId, own.value);
  else merged.delete(formId);
  return merged;
}

export function collectVariableErrors(
  schema: FormSchema,
  context: FormSchemaValidationContext,
  errors: FormSchemaValidationError[],
): void {
  const variables = schema.variables ?? [];
  const sourceForms = withOwnFields(schema, context);
  const fieldKinds: FieldKindScope = {
    fields: collectFieldKinds(
      (schema.pages ?? []).flatMap((page) => page.fields ?? []),
    ),
    sourceFields: new Map(
      [...sourceForms].map(([formId, fields]) => [
        formId,
        collectFieldKinds(fields),
      ]),
    ),
    formId: context.formId,
  };
  const declared = new Set<string>();

  // An input the picker could never have offered reads as `any`, so
  // `checkFormulaInputs` reports one focused error instead of the type checker
  // adding one per use.
  const readableFields = variableFieldScope(schema, sourceForms);
  const unansweredContext = {
    answers: {},
    fields: readableFields.fields,
    sources: new Map(
      [...readableFields.sourceFields].map(([formId, fields]) => [
        formId,
        { fields, responses: [] },
      ]),
    ),
    aggregates: new Map(
      variableAggregateSources(variables).map((source) => [
        aggregateSourceKey(source),
        {},
      ]),
    ),
  };
  const scope: FormulaCheckScope = {
    fieldKinds,
    readableFields,
    unansweredContext,
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

    checkFormula({
      formula: variable,
      scope,
      pushInputError: push,
      pushFormulaError: (message) =>
        push(`Formula for "${variable.name}": ${message}`),
      typeCheck: checkVariableFormulaType,
      // Past the budget unanswered, it blocks the form for anyone yet to answer.
      evaluate: evaluateVariable,
    });
  }

  const optionsFields = collectOptionsFormulaFields(schema);
  for (const { field } of optionsFields) {
    const push = (message: string) =>
      errors.push({
        blockId: field.id,
        message: `Options formula: ${message}`,
      });
    checkFormula({
      formula: field.optionsFormula,
      scope,
      pushInputError: push,
      pushFormulaError: push,
      rejectInput: (inputName, input) =>
        input.kind === "aggregate"
          ? `Input "${inputName}" counts members' answers, which an options formula can't read`
          : undefined,
      typeCheck: checkOptionsFormulaType,
      // Nothing answered yet, and no submissions to read, is how every member
      // first meets the field.
      evaluate: evaluateOptionsFormula,
    });
  }
  const order = optionsFormulaOrder(optionsFields);
  if (!order.ok) {
    errors.push({
      blockId: order.error[0],
      message: optionsCycleMessage(order.error),
    });
  }
}

type FormulaCheckScope = {
  fieldKinds: FieldKindScope;
  readableFields: VariableFieldScope;
  unansweredContext: VariableResolutionContext;
};

function checkFormula<T extends Formula>(params: {
  formula: T;
  scope: FormulaCheckScope;
  pushInputError: (message: string) => void;
  pushFormulaError: (message: string) => void;
  rejectInput?: (
    inputName: string,
    input: Formula["inputs"][string],
  ) => string | undefined;
  typeCheck: (
    formula: string,
    inputTypes: ReadonlyMap<string, string>,
  ) => Result<unknown, string>;
  evaluate: (
    formula: T,
    context: VariableResolutionContext,
  ) => Result<unknown, string>;
}): void {
  const { formula, scope, pushInputError, pushFormulaError } = params;
  let inputsFailed = false;
  const pushInput = (message: string) => {
    inputsFailed = true;
    pushInputError(message);
  };
  for (const [inputName, input] of Object.entries(formula.inputs)) {
    const rejected = params.rejectInput?.(inputName, input);
    if (rejected !== undefined) pushInput(rejected);
  }
  checkFormulaInputs(formula, scope.fieldKinds, pushInput);

  const compiled = compileVariableExpression(
    formula.formula,
    new Set(Object.keys(formula.inputs)),
  );
  if (!compiled.ok) {
    pushFormulaError(compiled.error);
    return;
  }
  const typed = params.typeCheck(
    formula.formula,
    variableTypeEnv(formula, scope.readableFields),
  );
  if (!typed.ok) {
    pushFormulaError(typed.error);
    return;
  }
  if (inputsFailed) return;

  const unanswered = params.evaluate(formula, scope.unansweredContext);
  if (!unanswered.ok) pushFormulaError(unanswered.error);
}

type FieldKindScope = {
  fields: Map<string, CollectedField>;
  sourceFields: Map<number, Map<string, CollectedField>>;
  formId: number | undefined;
};

function checkFormulaInputs(
  formula: Formula,
  scope: FieldKindScope,
  push: (message: string) => void,
): void {
  for (const [inputName, input] of Object.entries(formula.inputs)) {
    const sourceFormId = inputSourceFormId(input);
    // An aggregate may count this form's own submissions.
    if (isSourceInput(input) && sourceFormId === scope.formId) {
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
          `Input "${inputName}" reads field "${input.fieldId}", which is inside a list. ${input.kind === "aggregate" ? "Only a multiselect outside a list can be counted" : "Read the whole list instead"}`,
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
      case "aggregate": {
        const field = topLevelField();
        if (field === undefined) break;
        if (field.kind !== "multiselect") {
          push(
            `Input "${inputName}" counts answers to "${input.fieldId}", whose kind is ${field.kind}. Pick a multiselect question`,
          );
        } else if (field.optionsFromFormula) {
          push(
            `Input "${inputName}" counts answers to "${input.fieldId}", whose options come from a formula. Only fixed options can be counted`,
          );
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
  fields.set(item.id, {
    kind: item.kind,
    insideList: false,
    subFields,
    optionsFromFormula:
      item.kind === "multiselect" && item.optionsFormula !== undefined,
  });
  for (const sub of subFields) {
    fields.set(sub.id, {
      kind: sub.kind,
      insideList: true,
      subFields: [],
      optionsFromFormula: false,
    });
  }
}
