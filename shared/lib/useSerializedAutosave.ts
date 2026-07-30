import { useCallback, useEffect, useRef, useState } from "react";

type SerializedAutosaveOptions<T> = {
  candidate: T | null;
  save: (candidate: T) => Promise<void>;
  onSaved: (candidate: T) => void;
  errorMessage: (error: unknown) => string;
  debounceMs: number;
};

export type SerializedAutosaveState = {
  saving: boolean;
  saveError: string | null;
  /** Allows retry after a failure or superseding edit. */
  clearFailure: () => void;
  /** Invalidates callbacks from requests predating an authoritative reload. */
  resetAutosave: () => void;
};

/**
 * Serializes derived save snapshots. In-flight candidates are re-derived after
 * acknowledgement against the latest server state.
 */
export function useSerializedAutosave<T>({
  candidate,
  save,
  onSaved,
  errorMessage,
  debounceMs,
}: SerializedAutosaveOptions<T>): SerializedAutosaveState {
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);
  const errorMessageRef = useRef(errorMessage);
  saveRef.current = save;
  onSavedRef.current = onSaved;
  errorMessageRef.current = errorMessage;

  const active = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const failedCandidate = useRef<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);

  const wake = useCallback(() => {
    if (mounted.current) {
      setCycle((previous) => previous + 1);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  const clearFailure = useCallback(() => {
    failedCandidate.current = null;
    setSaveError(null);
    wake();
  }, [wake]);

  const resetAutosave = useCallback(() => {
    generation.current++;
    clearFailure();
  }, [clearFailure]);

  useEffect(() => {
    if (
      candidate === null ||
      active.current ||
      failedCandidate.current === candidate
    ) {
      return;
    }

    const scheduledGeneration = generation.current;
    const timeoutId = setTimeout(() => {
      if (
        active.current ||
        scheduledGeneration !== generation.current ||
        failedCandidate.current === candidate
      ) {
        return;
      }

      active.current = true;
      setSaving(true);
      setSaveError(null);

      void saveRef
        .current(candidate)
        .then(() => {
          if (scheduledGeneration !== generation.current) {
            return;
          }
          failedCandidate.current = null;
          onSavedRef.current(candidate);
        })
        .catch((error: unknown) => {
          if (scheduledGeneration !== generation.current) {
            return;
          }
          failedCandidate.current = candidate;
          setSaveError(errorMessageRef.current(error));
        })
        .finally(() => {
          active.current = false;
          if (!mounted.current) {
            return;
          }
          setSaving(false);
          // Re-derive after React applies acknowledgement; in-flight
          // candidates used an older baseline.
          wake();
        });
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [candidate, cycle, debounceMs, wake]);

  return {
    saving,
    saveError,
    clearFailure,
    resetAutosave,
  };
}
