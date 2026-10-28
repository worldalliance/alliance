import { type FormValue } from "@alliance/common/forms/form-schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  tasksGetFormDraft,
  tasksSaveFormDraft,
  type FormDraftDto,
  type SaveFormDraftDto,
} from "../client";
import { queryKeys } from "../lib/queryKeys";

const DRAFT_SAVE_DEBOUNCE_MS = 1500;

/**
 * Keeps a member's in-progress answers on the server so they can finish the
 * form on another device. The saved draft is not a submission: it creates no
 * action activity, so nothing about it reaches feeds, counts or reminders.
 *
 * The local (localStorage / AsyncStorage) copy stays the fast path. This is
 * the slow, cross-device one, so a failed save costs the member nothing on
 * the device they are typing on.
 */
export function useFormDraftSync(args: {
  enabled: boolean;
  formId: number;
  actionId: number;
  formSnapshotId: number | null;
  answers: Record<string, FormValue>;
  publicAnswers: Record<string, boolean>;
  currentPageIndex: number;
  /** Saving starts once the member has edited something, so opening a form leaves no draft. */
  edited: boolean;
  /**
   * Called with the server's `updatedAt` each time a save lands. Persist it
   * beside the local draft: a stored draft carrying a different one was
   * written somewhere else, and is the thing worth restoring.
   */
  onSaved: (updatedAt: string) => void;
}): {
  /** The stored draft, or null until the fetch lands. */
  serverDraft: FormDraftDto | null;
  saveFailed: boolean;
  /** Call before submitting or withdrawing: the server deletes the draft, and a save queued behind the request would write it back. */
  pauseSyncing: () => void;
  /** Call when a submission the caller paused for didn't go through. */
  resumeSyncing: () => void;
} {
  const {
    enabled,
    formId,
    actionId,
    formSnapshotId,
    answers,
    publicAnswers,
    currentPageIndex,
    edited,
    onSaved,
  } = args;
  const [saveFailed, setSaveFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  const draftQuery = useQuery({
    queryKey: queryKeys.taskFormDraft(formId),
    queryFn: () =>
      tasksGetFormDraft({ path: { id: formId }, throwOnError: true }).then(
        (response) => response.data.draft ?? null,
      ),
    enabled,
    // Each mount or re-enable reads the server again, and `fetched` waits for
    // that read, including one paused offline: another device may have saved
    // since, and a save opened on a cached copy overwrites it.
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // A failed fetch reads as no draft, so only a successful one opens the save
  // path.
  const fetched = draftQuery.isSuccess && draftQuery.fetchStatus === "idle";

  const { mutate: saveDraft } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: SaveFormDraftDto }) =>
      tasksSaveFormDraft({
        path: { id },
        body,
        throwOnError: true,
      }).then((response) => response.data),
    // Paused offline saves would replay together on reconnect, in any order,
    // with no failure shown meanwhile; each save fails instead.
    networkMode: "always",
    // Here rather than per `mutate`, which fires only for the latest call: a
    // save overtaken by the next must still record its `updatedAt`.
    onSuccess: (saved) => {
      setSaveFailed(false);
      onSaved(saved.updatedAt);
    },
    onError: () => setSaveFailed(true),
  });

  useEffect(() => {
    // A save before the fetch lands overwrites another device's draft with
    // this one's near-empty state.
    if (!enabled || !edited || !fetched || paused || formSnapshotId === null)
      return;
    const timer = setTimeout(() => {
      saveDraft({
        id: formId,
        body: {
          actionId,
          formSnapshotId,
          answers,
          publicAnswers,
          currentPageIndex,
        },
      });
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    enabled,
    edited,
    fetched,
    paused,
    formId,
    actionId,
    formSnapshotId,
    answers,
    publicAnswers,
    currentPageIndex,
    saveDraft,
  ]);

  const pauseSyncing = useCallback(() => setPaused(true), []);
  const resumeSyncing = useCallback(() => setPaused(false), []);

  return {
    serverDraft: fetched ? draftQuery.data : null,
    saveFailed,
    pauseSyncing,
    resumeSyncing,
  };
}
