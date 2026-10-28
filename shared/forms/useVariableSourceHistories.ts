import type { FormSchema } from "@alliance/common/forms/form-schema";
import { formulaHistoryFormIds } from "@alliance/common/forms/formula-options";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import {
  EMPTY_HISTORY,
  readSourceHistory,
} from "@alliance/common/forms/variable-source-history";
import { R } from "@alliance/common/result";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useId } from "react";
import {
  tasksGetMemberFormResponseHistoryAdmin,
  tasksGetMyFormResponseHistory,
} from "../client";
import { thrownStatus } from "../lib/hey-api";
import { useStableIds } from "../lib/useStableIds";
import { openFormQueryOptions } from "./openFormQueryOptions";

export enum HistoryReader {
  /** A guest, or an admin preview with no member picked: no submissions. */
  Nobody = "nobody",
  /** Whether anyone is signed in isn't known yet. */
  Pending = "pending",
  /** The signed-in member, read from the session. */
  Self = "self",
  /** An admin previewing or reviewing a member's form. */
  Member = "member",
}

export type HistorySubject =
  | { reader: HistoryReader.Nobody }
  | { reader: HistoryReader.Pending }
  | { reader: HistoryReader.Self }
  | { reader: HistoryReader.Member; userId: number };

/**
 * An admin renderer never reads the signed-in admin's own answers: a preview
 * id that isn't a user's, like the builder's "preview", reads as nobody's.
 */
export function historySubject(params: {
  adminPreviewUserId: string | number | undefined;
  signedIn: boolean;
  userLoading: boolean;
}): HistorySubject {
  if (params.adminPreviewUserId !== undefined) {
    const userId = Number(params.adminPreviewUserId);
    return Number.isInteger(userId) && userId > 0
      ? { reader: HistoryReader.Member, userId }
      : { reader: HistoryReader.Nobody };
  }
  if (params.userLoading) return { reader: HistoryReader.Pending };
  return params.signedIn
    ? { reader: HistoryReader.Self }
    : { reader: HistoryReader.Nobody };
}

export enum SourceHistoriesStatus {
  Loading = "loading",
  Failed = "failed",
  /**
   * A source form no longer exists, so no retry can load it. Every other
   * source has loaded.
   */
  SourceDeleted = "sourceDeleted",
  Ready = "ready",
}

export type SourceHistories =
  | { status: SourceHistoriesStatus.Loading }
  | { status: SourceHistoriesStatus.Failed; retry: () => void }
  | {
      status: SourceHistoriesStatus.SourceDeleted;
      sources: ReadonlyMap<number, VariableSourceHistory>;
      deletedFormIds: ReadonlySet<number>;
    }
  | {
      status: SourceHistoriesStatus.Ready;
      sources: ReadonlyMap<number, VariableSourceHistory>;
    };

export const NO_SOURCE_HISTORIES: ReadonlyMap<number, VariableSourceHistory> =
  new Map();

const NO_FORM_IDS: ReadonlySet<number> = new Set();

export function evaluatedSources(histories: SourceHistories): {
  sources: ReadonlyMap<number, VariableSourceHistory>;
  deletedFormIds: ReadonlySet<number>;
} {
  switch (histories.status) {
    case SourceHistoriesStatus.Loading:
    case SourceHistoriesStatus.Failed:
      return { sources: NO_SOURCE_HISTORIES, deletedFormIds: NO_FORM_IDS };
    case SourceHistoriesStatus.SourceDeleted:
      return histories;
    case SourceHistoriesStatus.Ready:
      return { sources: histories.sources, deletedFormIds: NO_FORM_IDS };
    default:
      throw new Error(
        `unknown source histories status: ${histories satisfies never}`,
      );
  }
}

class SourceFormDeleted extends Error {}

// Both history endpoints answer 404 only for a form that doesn't exist.
const historyError = (error: unknown): Error =>
  thrownStatus(error) === 404
    ? new SourceFormDeleted("Source form not found", { cause: error })
    : R.toError(error);

async function fetchHistory(
  formId: number,
  subject: Exclude<
    HistorySubject,
    { reader: HistoryReader.Nobody | HistoryReader.Pending }
  >,
): Promise<VariableSourceHistory> {
  const { reader } = subject;
  switch (reader) {
    case HistoryReader.Self: {
      const { data } = await tasksGetMyFormResponseHistory({
        path: { id: formId },
        throwOnError: true,
      });
      return R.unwrap(readSourceHistory(data));
    }
    case HistoryReader.Member: {
      const { data } = await tasksGetMemberFormResponseHistoryAdmin({
        path: { formId, userId: subject.userId },
        throwOnError: true,
      });
      return R.unwrap(readSourceHistory(data));
    }
    default:
      throw new Error(`unknown history reader: ${reader satisfies never}`);
  }
}

/**
 * The submitted answers every variable or options formula input reading
 * another form needs, fetched once per subject and reload so an open form's
 * values stay put until its caller reloads. A source form added after the
 * others load fetches only itself, and retry refetches only the forms that
 * failed.
 */
export function useVariableSourceHistories(params: {
  schema: FormSchema;
  subject: HistorySubject;
  /** Changing it refetches every history. */
  reload?: number;
}): SourceHistories {
  const { schema, subject, reload = 0 } = params;
  const formIds = useStableIds(formulaHistoryFormIds(schema));
  // Each open form loads its own histories, so a form opened later never
  // shows answers another open form loaded before a submission.
  const instance = useId();
  const reader =
    subject.reader === HistoryReader.Nobody ||
    subject.reader === HistoryReader.Pending
      ? undefined
      : subject;

  const combine = useCallback(
    (
      results: UseQueryResult<VariableSourceHistory, Error>[],
    ): SourceHistories => {
      if (subject.reader === HistoryReader.Pending && formIds.length > 0) {
        return { status: SourceHistoriesStatus.Loading };
      }
      if (
        subject.reader === HistoryReader.Nobody ||
        subject.reader === HistoryReader.Pending
      ) {
        return {
          status: SourceHistoriesStatus.Ready,
          sources: new Map(formIds.map((formId) => [formId, EMPTY_HISTORY])),
        };
      }
      const sources = new Map<number, VariableSourceHistory>();
      const deletedFormIds = new Set<number>();
      let failed = false;
      for (const [index, result] of results.entries()) {
        if (result.isPending) return { status: SourceHistoriesStatus.Loading };
        if (result.isSuccess) {
          sources.set(formIds[index], result.data);
        } else if (result.error instanceof SourceFormDeleted) {
          deletedFormIds.add(formIds[index]);
        } else {
          failed = true;
        }
      }
      // A failure a retry may clear outranks a deletion none can.
      if (failed) {
        const retry = () => {
          for (const result of results) {
            if (result.isError) void result.refetch();
          }
        };
        return { status: SourceHistoriesStatus.Failed, retry };
      }
      return deletedFormIds.size > 0
        ? {
            status: SourceHistoriesStatus.SourceDeleted,
            sources,
            deletedFormIds,
          }
        : { status: SourceHistoriesStatus.Ready, sources };
    },
    [subject.reader, formIds],
  );

  return useQueries({
    queries:
      reader === undefined
        ? []
        : formIds.map((formId) => ({
            queryKey: [
              "variableSourceHistory",
              instance,
              reader,
              formId,
              reload,
            ],
            queryFn: () =>
              fetchHistory(formId, reader).catch((thrown: unknown) => {
                const error = historyError(thrown);
                console.error(
                  `Failed to load answers from form ${formId}`,
                  error,
                );
                throw error;
              }),
            ...openFormQueryOptions,
          })),
    combine,
  });
}
