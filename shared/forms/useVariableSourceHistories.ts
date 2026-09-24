import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import { variableSourceFormIds } from "@alliance/common/forms/variables";
import { R, type Result } from "@alliance/common/result";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  tasksGetMemberFormResponseHistoryAdmin,
  tasksGetMyFormResponseHistory,
} from "../client";
import { thrownStatus } from "../lib/hey-api";
import { parseFormResponseHistory } from "../parsed-dtos";

export enum HistoryReader {
  /** A guest, or an admin preview with no member picked: no submissions. */
  Nobody = "nobody",
  /** The signed-in member, read from the session. */
  Self = "self",
  /** An admin previewing or reviewing a member's form. */
  Member = "member",
}

export type HistorySubject =
  | { reader: HistoryReader.Nobody }
  | { reader: HistoryReader.Self }
  | { reader: HistoryReader.Member; userId: number };

/**
 * An admin renderer never reads the signed-in admin's own answers: a preview
 * id that isn't a user's, like the builder's "preview", reads as nobody's.
 */
export function historySubject(params: {
  adminPreviewUserId: string | number | undefined;
  signedIn: boolean;
}): HistorySubject {
  if (params.adminPreviewUserId !== undefined) {
    const userId = Number(params.adminPreviewUserId);
    return Number.isInteger(userId) && userId > 0
      ? { reader: HistoryReader.Member, userId }
      : { reader: HistoryReader.Nobody };
  }
  return params.signedIn
    ? { reader: HistoryReader.Self }
    : { reader: HistoryReader.Nobody };
}

export enum SourceHistoriesStatus {
  Loading = "loading",
  Failed = "failed",
  /** A source form no longer exists, so no retry can load it. */
  SourceDeleted = "sourceDeleted",
  Ready = "ready",
}

export type SourceHistories =
  | { status: SourceHistoriesStatus.Loading }
  | { status: SourceHistoriesStatus.Failed; retry: () => void }
  | { status: SourceHistoriesStatus.SourceDeleted }
  | {
      status: SourceHistoriesStatus.Ready;
      sources: ReadonlyMap<number, VariableSourceHistory>;
    };

export const NO_SOURCE_HISTORIES: ReadonlyMap<number, VariableSourceHistory> =
  new Map();

const EMPTY_HISTORY: VariableSourceHistory = {
  fields: new Map(),
  responses: [],
};

class SourceFormDeleted extends Error {}

// Both history endpoints answer 404 only for a form that doesn't exist.
const historyError = (error: unknown): Error =>
  thrownStatus(error) === 404
    ? new SourceFormDeleted("Source form not found", { cause: error })
    : R.toError(error);

async function fetchHistory(
  formId: number,
  subject: Exclude<HistorySubject, { reader: HistoryReader.Nobody }>,
): Promise<Result<VariableSourceHistory, Error>> {
  const { reader } = subject;
  switch (reader) {
    case HistoryReader.Self: {
      const response = await R.fromPromise(
        tasksGetMyFormResponseHistory({
          path: { id: formId },
          throwOnError: true,
        }),
        historyError,
      );
      return R.flatMap(response, ({ data }) => parseFormResponseHistory(data));
    }
    case HistoryReader.Member: {
      const response = await R.fromPromise(
        tasksGetMemberFormResponseHistoryAdmin({
          path: { formId, userId: subject.userId },
          throwOnError: true,
        }),
        historyError,
      );
      return R.flatMap(response, ({ data }) => parseFormResponseHistory(data));
    }
    default:
      throw new Error(`unknown history reader: ${reader satisfies never}`);
  }
}

type Loaded = {
  key: string;
  byForm: ReadonlyMap<number, Result<VariableSourceHistory, Error>>;
};

/**
 * The submitted answers every variable input reading another form needs,
 * fetched once per subject so an open form's values stay put. A source form
 * added after the others load fetches only itself, and retry refetches only
 * the forms that failed.
 */
export function useVariableSourceHistories(params: {
  schema: FormSchema;
  subject: HistorySubject;
}): SourceHistories {
  const { schema, subject } = params;
  const idsKey = variableSourceFormIds(schema.variables).join(",");
  const formIds = useMemo(
    () => (idsKey === "" ? [] : idsKey.split(",").map(Number)),
    [idsKey],
  );
  const key =
    subject.reader === HistoryReader.Member
      ? `${subject.reader}:${subject.userId}`
      : subject.reader;

  const [loaded, setLoaded] = useState<Loaded>({ key, byForm: new Map() });
  const byForm = loaded.key === key ? loaded.byForm : undefined;
  const missingKey = formIds.filter((formId) => !byForm?.has(formId)).join(",");

  // Read through the key so a response for an earlier member can never land in
  // this one's state.
  useEffect(() => {
    if (subject.reader === HistoryReader.Nobody || missingKey === "") return;
    let cancelled = false;
    const missing = missingKey.split(",").map(Number);
    void Promise.all(
      missing.map(async (formId) => {
        const history = await fetchHistory(formId, subject);
        if (!history.ok) {
          console.error(
            `Failed to load answers from form ${formId}`,
            history.error,
          );
        }
        return [formId, history] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setLoaded((prev) => ({
        key,
        byForm: new Map([...(prev.key === key ? prev.byForm : []), ...entries]),
      }));
    });
    return () => {
      cancelled = true;
    };
    // `key` holds everything the fetch reads from `subject`, which is a fresh
    // object each render.
  }, [key, missingKey]);

  const retry = useCallback(
    () =>
      setLoaded((prev) => ({
        key: prev.key,
        byForm: new Map([...prev.byForm].filter(([, history]) => history.ok)),
      })),
    [],
  );

  return useMemo((): SourceHistories => {
    if (subject.reader === HistoryReader.Nobody) {
      return {
        status: SourceHistoriesStatus.Ready,
        sources: new Map(formIds.map((formId) => [formId, EMPTY_HISTORY])),
      };
    }
    const results = formIds.map((formId) => byForm?.get(formId));
    if (results.some((result) => result === undefined)) {
      return { status: SourceHistoriesStatus.Loading };
    }
    if (
      results.some(
        (result) =>
          result?.ok === false && result.error instanceof SourceFormDeleted,
      )
    ) {
      return { status: SourceHistoriesStatus.SourceDeleted };
    }
    const sources = new Map<number, VariableSourceHistory>();
    for (const [index, result] of results.entries()) {
      if (result === undefined || !result.ok) {
        return { status: SourceHistoriesStatus.Failed, retry };
      }
      sources.set(formIds[index], result.value);
    }
    return { status: SourceHistoriesStatus.Ready, sources };
  }, [subject.reader, formIds, byForm, retry]);
}
