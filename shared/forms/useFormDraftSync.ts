import { type FormValue } from "@alliance/common/forms/form-schema";
import { useCallback, useEffect, useState } from "react";
import {
  tasksGetFormDraft,
  tasksSaveFormDraft,
  type FormDraftDto,
} from "../client";

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
  const [serverDraft, setServerDraft] = useState<FormDraftDto | null>(null);
  const [fetched, setFetched] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // A renderer whose form changes under it keeps this hook mounted, and the
    // previous form's draft and open save path would both carry over.
    setServerDraft(null);
    setFetched(false);
    let cancelled = false;
    tasksGetFormDraft({ path: { id: formId } })
      .then((response) => {
        if (cancelled || !response.response.ok) return;
        setServerDraft(response.data?.draft ?? null);
        setFetched(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, formId]);

  useEffect(() => {
    // A save before the fetch lands overwrites another device's draft with
    // this one's near-empty state. A failed fetch reads as no draft, so only
    // a successful one opens the save path.
    if (!enabled || !edited || !fetched || paused || formSnapshotId === null)
      return;
    const timer = setTimeout(() => {
      tasksSaveFormDraft({
        path: { id: formId },
        body: {
          actionId,
          formSnapshotId,
          answers,
          publicAnswers,
          currentPageIndex,
        },
      })
        .then((response) => {
          setSaveFailed(!response.response.ok);
          if (response.data) {
            onSaved(response.data.updatedAt);
          }
        })
        .catch(() => {
          setSaveFailed(true);
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
    onSaved,
  ]);

  const pauseSyncing = useCallback(() => setPaused(true), []);
  const resumeSyncing = useCallback(() => setPaused(false), []);

  return { serverDraft, saveFailed, pauseSyncing, resumeSyncing };
}
