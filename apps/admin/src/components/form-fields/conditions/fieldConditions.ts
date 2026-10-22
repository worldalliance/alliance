import type {
  AnyField,
  CheckboxField,
  ContractField,
  CustomComponentField,
  EmailField,
  MultiSelectField,
  NumberField,
  PhoneField,
  RadioField,
  RangeField,
  SelectField,
  TextareaField,
  TextField,
} from "@alliance/common/forms/form-schema";
import { getRangeValues } from "@alliance/common/forms/range";
import {
  SelectedCountComparison,
  type Condition,
} from "@alliance/common/forms/visible-if-formula";

type PresenceControllerField =
  | TextField
  | TextareaField
  | EmailField
  | PhoneField
  | CustomComponentField;

export type ControllerField =
  | CheckboxField
  | ContractField
  | RadioField
  | SelectField
  | MultiSelectField
  | RangeField
  | NumberField
  | PresenceControllerField;

export type FieldCondition = Extract<
  Condition,
  {
    kind:
      | "equals"
      | "includesOption"
      | "anySelected"
      | "selectedCount"
      | "hasValue";
  }
>;

export function isFieldCondition(cond: Condition): cond is FieldCondition {
  return (
    cond.kind === "equals" ||
    cond.kind === "includesOption" ||
    cond.kind === "anySelected" ||
    cond.kind === "selectedCount" ||
    cond.kind === "hasValue"
  );
}

// A custom component's value shape depends on the component, so its conditions
// only test presence.
function isPresenceController(f: AnyField): f is PresenceControllerField {
  return (
    f.kind === "text" ||
    f.kind === "textarea" ||
    f.kind === "email" ||
    f.kind === "phone" ||
    f.kind === "custom"
  );
}

export function isConditionalController(f: AnyField): f is ControllerField {
  return (
    f.kind === "checkbox" ||
    f.kind === "contract" ||
    f.kind === "radio" ||
    f.kind === "select" ||
    f.kind === "multiselect" ||
    f.kind === "range" ||
    f.kind === "number" ||
    isPresenceController(f)
  );
}

export enum FieldComparison {
  Is = "is",
  IsNot = "isNot",
  Includes = "includes",
  Excludes = "excludes",
  AnySelected = "anySelected",
  NoneSelected = "noneSelected",
  SelectedCount = "selectedCount",
  Answered = "answered",
  Unanswered = "unanswered",
}

export const FIELD_COMPARISON_LABELS: Record<FieldComparison, string> = {
  [FieldComparison.Is]: "is",
  [FieldComparison.IsNot]: "is not",
  [FieldComparison.Includes]: "includes",
  [FieldComparison.Excludes]: "does not include",
  [FieldComparison.AnySelected]: "has any selection",
  [FieldComparison.NoneSelected]: "has no selection",
  [FieldComparison.SelectedCount]: "number selected",
  [FieldComparison.Answered]: "is answered",
  [FieldComparison.Unanswered]: "is unanswered",
};

/** Comparisons that are a NOT around their condition in the formula. */
export const COMPARISON_NEGATES: Record<FieldComparison, boolean> = {
  [FieldComparison.Is]: false,
  [FieldComparison.IsNot]: true,
  [FieldComparison.Includes]: false,
  [FieldComparison.Excludes]: true,
  [FieldComparison.AnySelected]: false,
  [FieldComparison.NoneSelected]: false,
  [FieldComparison.SelectedCount]: false,
  [FieldComparison.Answered]: false,
  [FieldComparison.Unanswered]: false,
};

/** The comparisons offered for a question, most common first. */
export function fieldComparisons(
  controller: ControllerField,
): FieldComparison[] {
  if (isPresenceController(controller)) {
    return [FieldComparison.Answered, FieldComparison.Unanswered];
  }
  switch (controller.kind) {
    case "checkbox":
      return [FieldComparison.Is];
    case "multiselect":
      return [
        FieldComparison.Includes,
        FieldComparison.Excludes,
        FieldComparison.AnySelected,
        FieldComparison.Unanswered,
        FieldComparison.SelectedCount,
      ];
    case "contract":
    case "radio":
    case "select":
    case "range":
    case "number":
      return [
        FieldComparison.Is,
        FieldComparison.IsNot,
        FieldComparison.Answered,
        FieldComparison.Unanswered,
      ];
    default:
      throw new Error(
        `unknown controller kind: ${JSON.stringify(controller satisfies never)}`,
      );
  }
}

/**
 * The comparison a rule shows, with `negated` meaning a NOT wraps it in the
 * formula. Null when the negation has no comparison of its own.
 */
export function comparisonOf(
  condition: FieldCondition,
  { negated }: { negated: boolean },
): FieldComparison | null {
  switch (condition.kind) {
    case "equals":
      return negated ? FieldComparison.IsNot : FieldComparison.Is;
    case "includesOption":
      return negated ? FieldComparison.Excludes : FieldComparison.Includes;
    case "hasValue":
      return condition.hasValue !== negated
        ? FieldComparison.Answered
        : FieldComparison.Unanswered;
    case "anySelected":
      if (negated) return null;
      return condition.anySelected
        ? FieldComparison.AnySelected
        : FieldComparison.NoneSelected;
    case "selectedCount":
      return negated ? null : FieldComparison.SelectedCount;
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(condition satisfies never)}`,
      );
  }
}

function defaultNumberEquals(controller: NumberField): number {
  if (
    typeof controller.defaultValue === "number" &&
    Number.isFinite(controller.defaultValue)
  ) {
    return controller.defaultValue;
  }
  if (typeof controller.min === "number" && Number.isFinite(controller.min)) {
    return controller.min;
  }
  return 0;
}

function defaultEqualsValue(
  controller: ControllerField,
): string | number | boolean {
  switch (controller.kind) {
    case "checkbox":
    case "contract":
      return true;
    case "number":
      return defaultNumberEquals(controller);
    case "range":
      return getRangeValues(controller)[0] ?? 1;
    case "radio":
    case "select":
    case "multiselect":
      return controller.options?.[0]?.value ?? "";
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "custom":
      return "";
    default:
      throw new Error(
        `unknown controller kind: ${JSON.stringify(controller satisfies never)}`,
      );
  }
}

export type RuleCondition<C extends Condition = Condition> = {
  condition: C;
  negated: boolean;
};

/**
 * The rule for `comparison` on `controller`, keeping `previous`'s value where
 * the comparison takes the same kind of value.
 */
export function applyFieldComparison(params: {
  comparison: FieldComparison;
  controller: ControllerField;
  sourceFormId: number | undefined;
  previous: FieldCondition | undefined;
}): RuleCondition<FieldCondition> {
  const { comparison, controller, sourceFormId, previous } = params;
  const base =
    sourceFormId === undefined
      ? { when: controller.id }
      : { when: controller.id, sourceFormId };
  const sameQuestion = previous?.when === controller.id;
  switch (comparison) {
    case FieldComparison.Is:
    case FieldComparison.IsNot:
      return {
        condition: {
          kind: "equals",
          ...base,
          equals:
            sameQuestion && previous?.kind === "equals"
              ? previous.equals
              : defaultEqualsValue(controller),
        },
        negated: COMPARISON_NEGATES[comparison],
      };
    case FieldComparison.Includes:
    case FieldComparison.Excludes:
      return {
        condition: {
          kind: "includesOption",
          ...base,
          includesOption:
            sameQuestion && previous?.kind === "includesOption"
              ? previous.includesOption
              : String(defaultEqualsValue(controller)),
        },
        negated: COMPARISON_NEGATES[comparison],
      };
    case FieldComparison.AnySelected:
    case FieldComparison.NoneSelected:
      return {
        condition: {
          kind: "anySelected",
          ...base,
          anySelected: comparison === FieldComparison.AnySelected,
        },
        negated: false,
      };
    case FieldComparison.SelectedCount:
      return {
        condition:
          sameQuestion && previous?.kind === "selectedCount"
            ? { ...previous, ...base }
            : {
                kind: "selectedCount",
                ...base,
                comparison: SelectedCountComparison.AtLeast,
                count: 1,
              },
        negated: false,
      };
    case FieldComparison.Answered:
    case FieldComparison.Unanswered:
      return {
        condition: {
          kind: "hasValue",
          ...base,
          hasValue: comparison === FieldComparison.Answered,
        },
        negated: false,
      };
    default:
      throw new Error(`unknown comparison: ${comparison satisfies never}`);
  }
}

/** A new rule on `controller`, starting at its most common comparison. */
export function defaultFieldRule(
  controller: ControllerField,
  sourceFormId: number | undefined,
): FieldCondition {
  const comparison =
    controller.kind === "multiselect" && controller.optionsFormula
      ? FieldComparison.AnySelected
      : fieldComparisons(controller)[0];
  return applyFieldComparison({
    comparison,
    controller,
    sourceFormId,
    previous: undefined,
  }).condition;
}
