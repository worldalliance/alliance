import type { OptionField } from "@alliance/common/forms/form-schema";
import type {
  Condition,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";

const buildValueCounts = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
};

export const findSingleOptionValueChange = (
  previousOptions: OptionField["options"] | undefined,
  nextOptions: OptionField["options"] | undefined,
): {
  previousValue: string;
  nextValue: string;
} | null => {
  if (!previousOptions || !nextOptions) {
    return null;
  }
  if (previousOptions.length !== nextOptions.length) {
    return null;
  }

  const previousValues = previousOptions.map((option) => option.value ?? "");
  const nextValues = nextOptions.map((option) => option.value ?? "");
  const previousCounts = buildValueCounts(previousValues);
  const nextCounts = buildValueCounts(nextValues);

  const removed: string[] = [];
  const added: string[] = [];

  previousCounts.forEach((count, value) => {
    const nextCount = nextCounts.get(value) ?? 0;
    if (nextCount < count) {
      for (let i = 0; i < count - nextCount; i += 1) {
        removed.push(value);
      }
    }
  });

  nextCounts.forEach((count, value) => {
    const previousCount = previousCounts.get(value) ?? 0;
    if (previousCount < count) {
      for (let i = 0; i < count - previousCount; i += 1) {
        added.push(value);
      }
    }
  });

  if (removed.length === 1 && added.length === 1) {
    return {
      previousValue: removed[0],
      nextValue: added[0],
    };
  }

  return null;
};

const mapConditionForOptionValue = (
  condition: Condition,
  controllerId: string,
  previousValue: string,
  nextValue: string,
): { condition: Condition; updated: boolean } => {
  switch (condition.kind) {
    case "includesOption":
      if (
        condition.sourceFormId == null &&
        condition.when === controllerId &&
        condition.includesOption === previousValue
      ) {
        return {
          condition: { ...condition, includesOption: nextValue },
          updated: true,
        };
      }
      return { condition, updated: false };
    case "equals":
      if (
        condition.sourceFormId == null &&
        condition.when === controllerId &&
        condition.equals === previousValue
      ) {
        return {
          condition: { ...condition, equals: nextValue },
          updated: true,
        };
      }
      return { condition, updated: false };
    case "anySelected":
    case "selectedCount":
    case "completedActionCount":
    case "deviceType":
    case "firstContractSigned":
    case "hasValue":
    case "outputBlockVisible":
    case "userHasCity":
    case "userPropertyHasValue":
    case "validator":
      return { condition, updated: false };
    default:
      throw new Error(
        `Unknown condition kind: ${(condition satisfies never as Condition).kind}`,
      );
  }
};

export const getUpdatedVisibilityFormula = (
  visibleIfFormula: VisibleIfFormula | undefined,
  controllerId: string,
  previousValue: string,
  nextValue: string,
): { changed: boolean; visibleIfFormula?: VisibleIfFormula } => {
  if (!visibleIfFormula?.conditions) {
    return { changed: false };
  }

  let updated = false;
  const nextConditions: Record<string, Condition> = {};
  for (const [name, cond] of Object.entries(visibleIfFormula.conditions)) {
    const { condition, updated: u } = mapConditionForOptionValue(
      cond,
      controllerId,
      previousValue,
      nextValue,
    );
    nextConditions[name] = condition;
    if (u) updated = true;
  }

  if (!updated) {
    return { changed: false };
  }

  return {
    changed: true,
    visibleIfFormula: { ...visibleIfFormula, conditions: nextConditions },
  };
};
