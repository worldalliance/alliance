import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  aggregateSourceKey,
  answeredSourceKey,
  variableAggregateSources,
  variableAnsweredSources,
  type VariableAggregateSource,
  type VariableCount,
} from "@alliance/common/forms/variable-aggregates";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  tasksCountVariableAggregatesAdmin,
  tasksGetVariableAggregates,
  type VariableAggregatesDto,
} from "../client";
import { openFormQueryOptions } from "./openFormQueryOptions";

export enum AggregateReader {
  /** An admin preview or review, which may count a schema not yet saved. */
  Admin = "admin",
  /** Anyone else, counting what a saved version of the form reads. */
  FormVersion = "formVersion",
}

export type AggregateTarget =
  | { reader: AggregateReader.Admin }
  | {
      reader: AggregateReader.FormVersion;
      formId: number;
      formSnapshotId: number;
    };

export enum VariableAggregatesStatus {
  Loading = "loading",
  Failed = "failed",
  /**
   * A counted form or question is gone, or the form has no saved version, so
   * no retry can load it.
   */
  SourceUnavailable = "sourceUnavailable",
  Ready = "ready",
}

type AggregateCounts = ReadonlyMap<string, VariableCount>;

export type VariableAggregates =
  | { status: VariableAggregatesStatus.Loading }
  | { status: VariableAggregatesStatus.Failed; retry: () => void }
  | {
      status: VariableAggregatesStatus.SourceUnavailable;
      aggregates: AggregateCounts;
    }
  | { status: VariableAggregatesStatus.Ready; aggregates: AggregateCounts };

const NO_AGGREGATES: AggregateCounts = new Map();

/**
 * An admin renderer counts the schema it shows. Anyone else counts a saved
 * version; without one, as for a form built into the app, nothing is counted.
 */
export function aggregateTarget(params: {
  admin: boolean;
  formId: number;
  formSnapshotId: number | null;
}): AggregateTarget | undefined {
  const { admin, formId, formSnapshotId } = params;
  if (admin) return { reader: AggregateReader.Admin };
  return formSnapshotId !== null && formSnapshotId > 0
    ? { reader: AggregateReader.FormVersion, formId, formSnapshotId }
    : undefined;
}

export function evaluatedAggregates(
  aggregates: VariableAggregates,
): AggregateCounts {
  switch (aggregates.status) {
    case VariableAggregatesStatus.Loading:
    case VariableAggregatesStatus.Failed:
      return NO_AGGREGATES;
    case VariableAggregatesStatus.SourceUnavailable:
    case VariableAggregatesStatus.Ready:
      return aggregates.aggregates;
    default:
      throw new Error(
        `unknown aggregates status: ${aggregates satisfies never}`,
      );
  }
}

type CountSources = {
  sources: VariableAggregateSource[];
  answeredSources: VariableAggregateSource[];
};

async function fetchAggregates(
  target: AggregateTarget,
  body: CountSources,
): Promise<VariableAggregatesDto> {
  const { reader } = target;
  switch (reader) {
    case AggregateReader.Admin:
      return (
        await tasksCountVariableAggregatesAdmin({
          body,
          throwOnError: true,
        })
      ).data;
    case AggregateReader.FormVersion:
      return (
        await tasksGetVariableAggregates({
          path: {
            formId: target.formId,
            formSnapshotId: target.formSnapshotId,
          },
          throwOnError: true,
        })
      ).data;
    default:
      throw new Error(`unknown aggregate reader: ${reader satisfies never}`);
  }
}

/**
 * The counts every aggregate input reads, fetched together once per open
 * form so they stay put while local answers change. Retry refetches them.
 */
export function useVariableAggregates(params: {
  schema: FormSchema;
  target: AggregateTarget | undefined;
}): VariableAggregates {
  const { schema, target } = params;
  const counted = useMemo((): CountSources => {
    const picked = (source: VariableAggregateSource) => source.fieldId !== "";
    return {
      sources: variableAggregateSources(schema.variables).filter(picked),
      answeredSources: variableAnsweredSources(schema.variables).filter(picked),
    };
  }, [schema.variables]);
  const none =
    counted.sources.length === 0 && counted.answeredSources.length === 0;

  const untargeted = target === undefined;
  const { data, isError, refetch } = useQuery({
    queryKey: ["variableAggregates", target, counted],
    queryFn:
      target !== undefined && !none
        ? () =>
            fetchAggregates(target, counted).catch((error: unknown) => {
              console.error("Failed to load aggregate counts", error);
              throw error;
            })
        : skipToken,
    ...openFormQueryOptions,
  });

  const retry = useCallback(() => void refetch(), [refetch]);

  return useMemo((): VariableAggregates => {
    if (none) {
      return { status: VariableAggregatesStatus.Ready, aggregates: new Map() };
    }
    if (untargeted) {
      return {
        status: VariableAggregatesStatus.SourceUnavailable,
        aggregates: NO_AGGREGATES,
      };
    }
    if (isError) return { status: VariableAggregatesStatus.Failed, retry };
    if (!data) return { status: VariableAggregatesStatus.Loading };
    const aggregates = new Map<string, VariableCount>();
    for (const aggregate of data.aggregates) {
      if (aggregate.counts !== null) {
        aggregates.set(aggregateSourceKey(aggregate), aggregate.counts);
      }
    }
    for (const answered of data.answered) {
      if (answered.count !== null) {
        aggregates.set(answeredSourceKey(answered), answered.count);
      }
    }
    const complete =
      counted.sources.every((source) =>
        aggregates.has(aggregateSourceKey(source)),
      ) &&
      counted.answeredSources.every((source) =>
        aggregates.has(answeredSourceKey(source)),
      );
    return complete
      ? { status: VariableAggregatesStatus.Ready, aggregates }
      : { status: VariableAggregatesStatus.SourceUnavailable, aggregates };
  }, [counted, none, untargeted, isError, data, retry]);
}
