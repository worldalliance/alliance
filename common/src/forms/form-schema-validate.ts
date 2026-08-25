import type { DisplayBlock } from "./display-blocks";
import {
  collectVariableInputFields,
  isQuestionField,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type ListField,
  type OutputViewSchema,
} from "./form-schema";
import { compileVariableExpression } from "./variable-expression";
import { checkVariableFormulaType } from "./variable-formula-check";
import {
  isFieldKindUsableAsVariableInput,
  VARIABLE_NAME_REGEX,
  variableTypeEnv,
  type FormVariable,
} from "./variables";
import {
  CONDITION_KIND_IS_ACCOUNT_DERIVED,
  type Condition,
  type VisibleIfFormula,
} from "./visible-if-formula";

export type FormSchemaValidationError = {
  viewId?: string;
  blockId: string;
  message: string;
};

type ContextKind = "input" | "output";

export function validateFormSchema(
  schema: FormSchema,
): FormSchemaValidationError[] {
  const errors: FormSchemaValidationError[] = [];

  // A page's visibility must be decidable from answers given before reaching
  // it, so a formula may only reference fields on strictly earlier pages: a
  // same-page field can't be answered while its page is hidden, and a later
  // field is only answered after this page was already skipped.
  const earlierFieldIds = new Set<string>();
  for (const page of schema.pages ?? []) {
    const blockId = page.id ?? "<unnamed>";
    checkConditions(
      page.visibleIfFormula,
      { context: "input", blockId },
      errors,
    );
    for (const cond of Object.values(page.visibleIfFormula?.conditions ?? {})) {
      const fieldId = getLocalFieldReference(cond);
      if (fieldId !== null && !earlierFieldIds.has(fieldId)) {
        errors.push({
          blockId,
          message: `Page visibility references field "${fieldId}", which must be on an earlier page`,
        });
      }
    }
    for (const item of page.fields ?? []) {
      collectInputErrors(item, errors);
      collectQuestionFieldIds(item, earlierFieldIds);
    }
  }

  collectVariableErrors(schema, errors);

  for (const view of schema.outputViews ?? []) {
    const outputBlockIds = new Set<string>();
    for (const b of view.blocks) {
      if (b.id) outputBlockIds.add(b.id);
    }

    for (const block of view.blocks) {
      const blockId = block.id ?? "<unnamed>";
      checkConditions(
        block.visibleIfFormula,
        {
          context: "output",
          allowedOutputBlockIds: outputBlockIds,
          viewId: view.id,
          blockId,
        },
        errors,
      );
    }

    collectCycleErrors(view, outputBlockIds, errors);
  }

  return errors;
}

type CollectedField = {
  kind: AnyField["kind"];
  // List sub-fields are collected so references to them are rejected as
  // unsupported rather than missing.
  insideList: boolean;
};

function collectFieldKinds(schema: FormSchema): Map<string, CollectedField> {
  const fields = new Map<string, CollectedField>();
  for (const page of schema.pages ?? []) {
    for (const item of page.fields ?? []) {
      if (!isQuestionField(item)) continue;
      fields.set(item.id, { kind: item.kind, insideList: false });
      if (item.kind === "list") {
        for (const sub of (item as ListField).fields ?? []) {
          fields.set(sub.id, { kind: sub.kind, insideList: true });
        }
      }
    }
  }
  return fields;
}

function collectVariableErrors(
  schema: FormSchema,
  errors: FormSchemaValidationError[],
): void {
  const variables = schema.variables ?? [];
  const fieldKinds = collectFieldKinds(schema);
  const declared = new Set<string>();

  // An input the picker could never have offered is absent here rather than
  // wrongly typed, which leaves it `any` so `checkVariableInputs` reports one
  // focused error instead of the type checker adding one per use.
  const readableFields = variableInputFieldsById(
    collectVariableInputFields(schema),
  );

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
    }
  }
}

function checkVariableInputs(
  variable: FormVariable,
  fields: Map<string, CollectedField>,
  push: (message: string) => void,
): void {
  for (const [inputName, input] of Object.entries(variable.inputs)) {
    // `field` is the only input kind today, so there is nothing for a
    // `satisfies never` default to narrow. The resolver table in `variables.ts`
    // is what makes adding a kind a compile error, at the point it has to be
    // turned into a value; a kind unknown here is simply left unchecked.
    if (input.kind !== "field") continue;

    const field = fields.get(input.fieldId);
    if (field === undefined) {
      push(`Input "${inputName}" references missing field "${input.fieldId}"`);
      continue;
    }
    if (field.insideList) {
      push(
        `Input "${inputName}" reads field "${input.fieldId}", which is inside a list — a list has one answer per row, so variables can't read it`,
      );
      continue;
    }
    if (!isFieldKindUsableAsVariableInput(field.kind)) {
      push(
        `Input "${inputName}" reads field "${input.fieldId}", whose kind (${field.kind}) has no value a formula can read`,
      );
    }
  }
}

function collectCycleErrors(
  view: OutputViewSchema,
  outputBlockIds: Set<string>,
  errors: FormSchemaValidationError[],
): void {
  const deps = new Map<string, string[]>();
  for (const block of view.blocks) {
    if (!block.id) continue;
    const edges: string[] = [];
    for (const cond of Object.values(
      block.visibleIfFormula?.conditions ?? {},
    )) {
      if (
        cond.kind === "outputBlockVisible" &&
        outputBlockIds.has(cond.outputBlockVisible)
      ) {
        edges.push(cond.outputBlockVisible);
      }
    }
    deps.set(block.id, edges);
  }

  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];
  const reported = new Set<string>();

  const visit = (nodeId: string): void => {
    if (color.get(nodeId) === BLACK) return;
    color.set(nodeId, GRAY);
    path.push(nodeId);
    for (const dep of deps.get(nodeId) ?? []) {
      if (color.get(dep) === GRAY) {
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart);
        const key = [...cycle].sort().join("|");
        if (!reported.has(key)) {
          reported.add(key);
          errors.push({
            viewId: view.id,
            blockId: cycle[0],
            message: `Cycle in outputBlockVisible references: ${[
              ...cycle,
              cycle[0],
            ].join(" -> ")}`,
          });
        }
      } else {
        visit(dep);
      }
    }
    path.pop();
    color.set(nodeId, BLACK);
  };

  for (const id of deps.keys()) {
    visit(id);
  }
}

/**
 * The id of the in-form field a condition reads, or null when it reads none
 * (validator/device/etc.) or resolves against another form's answers
 * (`sourceFormId`).
 */
function getLocalFieldReference(cond: Condition): string | null {
  switch (cond.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "hasValue":
      return cond.sourceFormId == null ? cond.when : null;
    case "validator":
    case "deviceType":
    case "outputBlockVisible":
    case "userHasCity":
    case "firstContractSigned":
    case "completedActionCount":
      return null;
    default:
      cond satisfies never;
      return null;
  }
}

function collectQuestionFieldIds(
  item: AnyField | DisplayBlock,
  into: Set<string>,
): void {
  if (!isQuestionField(item)) return;
  into.add(item.id);
  if (item.kind === "list") {
    for (const subField of (item as ListField).fields ?? []) {
      into.add(subField.id);
    }
  }
}

function collectInputErrors(
  item: AnyField | DisplayBlock,
  errors: FormSchemaValidationError[],
): void {
  const blockId = item.id ?? "<unnamed>";
  checkConditions(item.visibleIfFormula, { context: "input", blockId }, errors);
  if (!isQuestionField(item)) return;
  checkConditions(
    item.requiredIfFormula,
    { context: "input", blockId },
    errors,
  );
  if (item.kind === "list") {
    for (const subField of item.fields ?? []) {
      collectInputErrors(subField, errors);
    }
  }
}

type CheckCtx = {
  context: ContextKind;
  allowedOutputBlockIds?: Set<string>;
  viewId?: string;
  blockId: string;
};

function checkConditions(
  formula: VisibleIfFormula | undefined,
  ctx: CheckCtx,
  errors: FormSchemaValidationError[],
): void {
  const conditions = formula?.conditions;
  if (!conditions) return;
  for (const cond of Object.values(conditions)) {
    checkCondition(cond, ctx, errors);
  }
}

function checkCondition(
  cond: Condition,
  ctx: CheckCtx,
  errors: FormSchemaValidationError[],
): void {
  if (CONDITION_KIND_IS_ACCOUNT_DERIVED[cond.kind]) {
    if (ctx.context !== "input") {
      errors.push({
        viewId: ctx.viewId,
        blockId: ctx.blockId,
        message: `"${cond.kind}" condition is only valid on input fields`,
      });
    }
    if (
      cond.kind === "firstContractSigned" &&
      Number.isNaN(Date.parse(cond.date))
    ) {
      errors.push({
        viewId: ctx.viewId,
        blockId: ctx.blockId,
        message: `"firstContractSigned" condition has an invalid datetime: "${cond.date}"`,
      });
    }
    if (
      cond.kind === "completedActionCount" &&
      (!Number.isInteger(cond.atLeast) || cond.atLeast < 0)
    ) {
      errors.push({
        viewId: ctx.viewId,
        blockId: ctx.blockId,
        message: `"completedActionCount" condition has an invalid count: ${cond.atLeast}`,
      });
    }
    return;
  }
  if (cond.kind !== "outputBlockVisible") return;
  if (ctx.context !== "output") {
    errors.push({
      viewId: ctx.viewId,
      blockId: ctx.blockId,
      message:
        '"outputBlockVisible" condition is only valid on output-view blocks',
    });
    return;
  }
  if (!ctx.allowedOutputBlockIds?.has(cond.outputBlockVisible)) {
    errors.push({
      viewId: ctx.viewId,
      blockId: ctx.blockId,
      message: `References missing output block "${cond.outputBlockVisible}"`,
    });
  }
}
