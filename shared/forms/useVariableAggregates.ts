import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  aggregateSourceKey,
  variableAggregateSources,
  type VariableAggregateCounts,
  type VariableAggregateSource,
} from "@alliance/common/forms/variable-aggregates";
import { R, type Result } from "@alliance/common/result";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  tasksCountVariableAggregatesAdmin,
  tasksGetVariableAggregates,
  type VariableAggregatesDto,
} from "../client";

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

type AggregateCounts = ReadonlyMap<string, VariableAggregateCounts>;

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

async function fetchAggregates(
  target: AggregateTarget,
  sources: VariableAggregateSource[],
): Promise<Result<VariableAggregatesDto, Error>> {
  const { reader } = target;
  switch (reader) {
    case AggregateReader.Admin: {
      const response = await R.fromPromise(
        tasksCountVariableAggregatesAdmin({
          body: { sources },
          throwOnError: true,
        }),
        R.toError,
      );
      return R.map(response, ({ data }) => data);
    }
    case AggregateReader.FormVersion: {
      const response = await R.fromPromise(
        tasksGetVariableAggregates({
          path: {
            formId: target.formId,
            formSnapshotId: target.formSnapshotId,
          },
          throwOnError: true,
        }),
        R.toError,
      );
      return R.map(response, ({ data }) => data);
    }
    default:
      throw new Error(`unknown aggregate reader: ${reader satisfies never}`);
  }
}

type Loaded = { key: string; result: Result<VariableAggregatesDto, Error> };

/**
 * The counts every aggregate input reads, fetched together once per open
 * form so they stay put while local answers change. Retry refetches them.
 */
export function useVariableAggregates(params: {
  schema: FormSchema;
  target: AggregateTarget | undefined;
}): VariableAggregates {
  const { schema, target } = params;
  const sources = useMemo(
    () => variableAggregateSources(schema.variables),
    [schema.variables],
  );
  const sourcesKey = JSON.stringify(sources);
  const targetKey =
    target === undefined || target.reader === AggregateReader.Admin
      ? target?.reader
      : `${target.reader}:${target.formId}:${target.formSnapshotId}`;
  const key = sources.length === 0 ? "" : `${targetKey}|${sourcesKey}`;

  const untargeted = target === undefined;
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === "" || target === undefined) return;
    let cancelled = false;
    void fetchAggregates(target, sources).then((result) => {
      if (!result.ok) {
        console.error("Failed to load aggregate counts", result.error);
      }
      if (!cancelled) setLoaded({ key, result });
    });
    return () => {
      cancelled = true;
    };
    // `key` holds everything the fetch reads from `target` and `sources`.
  }, [key, attempt]);

  const retry = useCallback(() => {
    setLoaded(undefined);
    setAttempt((prev) => prev + 1);
  }, []);

  return useMemo((): VariableAggregates => {
    if (key === "") {
      return { status: VariableAggregatesStatus.Ready, aggregates: new Map() };
    }
    if (untargeted) {
      return {
        status: VariableAggregatesStatus.SourceUnavailable,
        aggregates: NO_AGGREGATES,
      };
    }
    if (loaded?.key !== key)
      return { status: VariableAggregatesStatus.Loading };
    if (!loaded.result.ok) {
      return { status: VariableAggregatesStatus.Failed, retry };
    }
    const aggregates = new Map<string, VariableAggregateCounts>();
    for (const aggregate of loaded.result.value.aggregates) {
      if (aggregate.counts !== null) {
        aggregates.set(aggregateSourceKey(aggregate), aggregate.counts);
      }
    }
    const complete = sources.every((source) =>
      aggregates.has(aggregateSourceKey(source)),
    );
    return complete
      ? { status: VariableAggregatesStatus.Ready, aggregates }
      : { status: VariableAggregatesStatus.SourceUnavailable, aggregates };
  }, [key, untargeted, loaded, sources, retry]);
}
