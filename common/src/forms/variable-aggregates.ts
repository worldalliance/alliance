import type { VariableCountInput } from "./variable-inputs";
import type { FormVariable } from "./variables";

/** Members counted under each configured option value, zeros included. */
export type VariableAggregateCounts = Readonly<Record<string, number>>;

export type VariableCount = VariableAggregateCounts | number;

export type VariableAggregateSource = {
  sourceFormId: number;
  fieldId: string;
};

export const AGGREGATE_INPUT_TYPE = "{ [value: string]: number }";

export function aggregateSourceKey(source: VariableAggregateSource): string {
  return `${source.sourceFormId}:${source.fieldId}`;
}

export function answeredSourceKey(source: VariableAggregateSource): string {
  return `answered:${aggregateSourceKey(source)}`;
}

const COUNT_SOURCE_KEYS: Record<
  VariableCountInput["kind"],
  (source: VariableAggregateSource) => string
> = { aggregate: aggregateSourceKey, answeredCount: answeredSourceKey };

/** Keys a count input's value in `VariableResolutionContext.aggregates`. */
export function countInputKey(input: VariableCountInput): string {
  return COUNT_SOURCE_KEYS[input.kind](input);
}

function countSources(
  variables: readonly FormVariable[] | undefined,
  kind: VariableCountInput["kind"],
): VariableAggregateSource[] {
  const sources = new Map<string, VariableAggregateSource>();
  for (const variable of variables ?? []) {
    for (const input of Object.values(variable.inputs)) {
      if (input.kind !== kind) continue;
      const source = {
        sourceFormId: input.sourceFormId,
        fieldId: input.fieldId,
      };
      sources.set(aggregateSourceKey(source), source);
    }
  }
  return [...sources.values()].sort(
    (a, b) =>
      a.sourceFormId - b.sourceFormId || a.fieldId.localeCompare(b.fieldId),
  );
}

/** Each question an aggregate input reads, once, in a stable order. */
export function variableAggregateSources(
  variables: readonly FormVariable[] | undefined,
): VariableAggregateSource[] {
  return countSources(variables, "aggregate");
}

/** Each question a members-who-answered input reads, once, in a stable order. */
export function variableAnsweredSources(
  variables: readonly FormVariable[] | undefined,
): VariableAggregateSource[] {
  return countSources(variables, "answeredCount");
}

/** The `aggregates` key of every count these variables read. */
export function variableCountKeys(
  variables: readonly FormVariable[] | undefined,
): string[] {
  return [
    ...variableAggregateSources(variables).map(aggregateSourceKey),
    ...variableAnsweredSources(variables).map(answeredSourceKey),
  ];
}
