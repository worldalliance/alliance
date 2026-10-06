import {
  SelectedCountComparison,
  type Condition,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { serializeVisibilityFormula } from "@alliance/shared/forms/visibilityFormula";

const COMPARISON_SYMBOLS: Record<SelectedCountComparison, string> = {
  [SelectedCountComparison.GreaterThan]: ">",
  [SelectedCountComparison.AtLeast]: "≥",
  [SelectedCountComparison.LessThan]: "<",
  [SelectedCountComparison.AtMost]: "≤",
  [SelectedCountComparison.Equals]: "=",
};

const CONTRACT_COMPARISON_TEXT: Record<
  Extract<Condition, { kind: "firstContractSigned" }>["comparison"],
  string
> = {
  before: "before",
  onOrAfter: "on or after",
};

export function describeCondition(
  condition: Condition,
  labelOf: (fieldId: string) => string,
): string {
  switch (condition.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "hasValue": {
      const source =
        condition.sourceFormId == null
          ? labelOf(condition.when)
          : `${condition.when} (form ${condition.sourceFormId})`;
      switch (condition.kind) {
        case "equals":
          return `${source} is ${JSON.stringify(condition.equals)}`;
        case "includesOption":
          return `${source} includes ${JSON.stringify(condition.includesOption)}`;
        case "anySelected":
          return `${source} has ${condition.anySelected ? "a" : "no"} selection`;
        case "selectedCount":
          return `${source} selections ${COMPARISON_SYMBOLS[condition.comparison]} ${condition.count}`;
        case "hasValue":
          return `${source} is ${condition.hasValue ? "answered" : "unanswered"}`;
        default:
          return condition satisfies never;
      }
    }
    case "validator":
      return `validator ${condition.validatorId} is ${condition.resultEquals ?? true}`;
    case "deviceType":
      return `device is ${condition.deviceType.join(" or ")}`;
    case "outputBlockVisible":
      return `block ${condition.outputBlockVisible} is ${condition.isVisible === false ? "hidden" : "visible"}`;
    case "userHasCity":
      return `user ${condition.userHasCity ? "has" : "has no"} city`;
    case "userPropertyHasValue":
      return `user ${condition.property} is ${condition.hasValue ? "set" : "unset"}`;
    case "firstContractSigned":
      return `first contract signed ${CONTRACT_COMPARISON_TEXT[condition.comparison]} ${condition.date}`;
    case "completedActionCount":
      return `completed actions ≥ ${condition.atLeast}`;
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(condition satisfies never)}`,
      );
  }
}

/** The formula with each condition name replaced by what it checks. */
export function summarizeVisibility(
  formula: VisibleIfFormula,
  labelOf: (fieldId: string) => string,
): string {
  return serializeVisibilityFormula(formula.formula, (name) => {
    const condition = formula.conditions[name];
    return condition ? describeCondition(condition, labelOf) : name;
  });
}
