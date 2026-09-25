import type { FormVariable } from "./variables";

/** Members counted under each configured option value, zeros included. */
export type VariableAggregateCounts = Readonly<Record<string, number>>;

export type VariableAggregateSource = {
  sourceFormId: number;
  fieldId: string;
};

export const AGGREGATE_INPUT_TYPE = "{ [value: string]: number }";

export function aggregateSourceKey(source: VariableAggregateSource): string {
  return `${source.sourceFormId}:${source.fieldId}`;
}

/** Each question an aggregate input reads, once, in a stable order. */
export function variableAggregateSources(
  variables: readonly FormVariable[] | undefined,
): VariableAggregateSource[] {
  const sources = new Map<string, VariableAggregateSource>();
  for (const variable of variables ?? []) {
    for (const input of Object.values(variable.inputs)) {
      if (input.kind !== "aggregate") continue;
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
