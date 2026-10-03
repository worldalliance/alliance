import type { DisplayBlock } from "./display-blocks";
import {
  collectFieldLookup,
  isQuestionField,
  MAX_RANGE_OPTION_COUNT,
  MIN_RANGE_OPTION_COUNT,
  type AnyField,
  type FormSchema,
  type ListField,
  type OutputFieldBlock,
  type OutputViewSchema,
  type PageItem,
} from "./form-schema";
import { getRangeOptionCount, isValidRangeSelection } from "./range";
import { sourceVariablesInSharedOutput } from "./variable-interpolation";
import type { SourceFormFields } from "./variable-scope";
import { collectVariableErrors } from "./variable-validate";
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

export type FormSchemaValidationContext = {
  /** Unset while the form is being created. */
  formId?: number;
  /** Must hold every form a variable or options formula input reads. */
  sourceForms: SourceFormFields;
};

export function validateFormSchema(
  schema: FormSchema,
  context: FormSchemaValidationContext = { sourceForms: new Map() },
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
      collectDisplayContentErrors(item, undefined, errors);
      collectQuestionFieldIds(item, earlierFieldIds);
    }
  }
  collectVisibilityCycleErrors(schema, errors);

  collectVariableErrors(schema, context, errors);
  for (const { name, location, viewId } of sourceVariablesInSharedOutput(
    schema,
  )) {
    errors.push({
      viewId,
      blockId: location,
      message: `Output views can't show #{${name}}, which reads submitted answers`,
    });
  }

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
      collectDisplayContentErrors(block, view.id, errors);
    }

    collectCycleErrors(view, outputBlockIds, errors);
  }

  return errors;
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

  for (const cycle of findCycles(deps)) {
    errors.push({
      viewId: view.id,
      blockId: cycle[0],
      message: `Cycle in outputBlockVisible references: ${[
        ...cycle,
        cycle[0],
      ].join(" -> ")}`,
    });
  }
}

// Edges run from a field to each in-form field its own formula reads; loops
// through a page's formula are not followed.
function collectVisibilityCycleErrors(
  schema: FormSchema,
  errors: FormSchemaValidationError[],
): void {
  const deps = new Map<string, string[]>();
  for (const field of collectFieldLookup(schema.pages ?? []).values()) {
    deps.set(
      field.id,
      Object.values(field.visibleIfFormula?.conditions ?? {}).flatMap(
        (cond) => getLocalFieldReference(cond) ?? [],
      ),
    );
  }

  for (const cycle of findCycles(deps)) {
    errors.push({
      blockId: cycle[0],
      message:
        cycle.length === 1
          ? `Visibility of "${cycle[0]}" depends on its own answer`
          : `Visibility conditions form a cycle: ${[...cycle, cycle[0]].join(
              " -> ",
            )}`,
    });
  }
}

/** Each distinct cycle in `deps`, as the node ids along it. */
function findCycles(deps: Map<string, string[]>): string[][] {
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];
  const reported = new Set<string>();
  const cycles: string[][] = [];

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
          cycles.push(cycle);
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
  return cycles;
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
    case "selectedCount":
    case "hasValue":
      return cond.sourceFormId == null ? cond.when : null;
    case "validator":
    case "deviceType":
    case "outputBlockVisible":
    case "userHasCity":
    case "userPropertyHasValue":
    case "firstContractSigned":
    case "completedActionCount":
      return null;
    default:
      cond satisfies never;
      return null;
  }
}

function collectQuestionFieldIds(item: PageItem, into: Set<string>): void {
  if (!isQuestionField(item)) return;
  into.add(item.id);
  if (item.kind === "list") {
    for (const subField of (item as ListField).fields ?? []) {
      into.add(subField.id);
    }
  }
}

// The schema permits an empty display block, so save-time validation is the
// last chance to warn the author before the block renders nothing.
function collectDisplayContentErrors(
  item: AnyField | DisplayBlock | OutputFieldBlock,
  viewId: string | undefined,
  errors: FormSchemaValidationError[],
): void {
  if (!("type" in item) || item.type !== "display") return;
  const blockId = item.id ?? "<unnamed>";
  if (item.kind === "images" && item.images.length === 0) {
    errors.push({
      viewId,
      blockId,
      message: "Images block has no images. Add one or remove the block",
    });
  }
  if (item.kind === "accordion") {
    if (item.sections.length === 0) {
      errors.push({
        viewId,
        blockId,
        message: "Accordion has no sections. Add one or remove the block",
      });
    }
    item.sections.forEach((section, index) => {
      if (section.title.trim().length === 0) {
        errors.push({
          viewId,
          blockId,
          message: `Accordion section ${index + 1} has no title. Name it or remove the section`,
        });
      }
      if (section.blocks.length === 0) {
        errors.push({
          viewId,
          blockId,
          message: `Accordion section ${index + 1} has no blocks. Add one or remove the section`,
        });
      }
      for (const nested of section.blocks) {
        collectDisplayContentErrors(nested, viewId, errors);
      }
    });
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
  if (
    item.kind === "range" &&
    item.optionCount !== undefined &&
    !(
      Number.isInteger(item.optionCount) &&
      item.optionCount >= MIN_RANGE_OPTION_COUNT &&
      item.optionCount <= MAX_RANGE_OPTION_COUNT
    )
  ) {
    errors.push({
      blockId,
      message: `Number of options must be a whole number from ${MIN_RANGE_OPTION_COUNT} to ${MAX_RANGE_OPTION_COUNT}`,
    });
  }
  if (
    item.kind === "range" &&
    item.defaultValue != null &&
    !isValidRangeSelection(item, item.defaultValue)
  ) {
    errors.push({
      blockId,
      message: `Default selection must be a whole number from 1 to ${getRangeOptionCount(item)}`,
    });
  }
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
