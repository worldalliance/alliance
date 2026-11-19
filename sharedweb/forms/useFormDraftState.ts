import { type FormValue } from "@alliance/common/forms/form-schema";
import { type FormResponseDto } from "@alliance/shared/client";
import { type DraftFetchState } from "@alliance/shared/forms/draftFetchState";
import {
  applyDefaultValues,
  clampPageIndex,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  readStoredFormDraft,
  restorableAnswers,
  restorablePublicAnswers,
  serializeStoredFormDraft,
} from "@alliance/shared/forms/formDrafts";
import { useDraftSettled } from "@alliance/shared/forms/useDraftSettled";
import { useFormDraftSync } from "@alliance/shared/forms/useFormDraftSync";
import { type useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import { useEffect, useMemo, useRef, useState } from "react";

type SchemaMaps = ReturnType<typeof useFormSchemaMaps>;

export function useFormDraftState({
  formId,
  actionId,
  formSnapshotId,
  persistKey,
  syncDraftToServer,
  readOnly,
  completedFormResponse,
  draftFormResponse,
  guestDraftFetch,
  initialPageIndex,
  userDefaultPublic,
  fieldLookup,
  defaultValueMap,
  outputFieldDefaultPublic,
  outputFieldIds,
  maxPageIndex,
}: {
  formId: number;
  actionId: number;
  formSnapshotId: number | null;
  persistKey?: string | null;
  syncDraftToServer?: boolean;
  readOnly: boolean;
  completedFormResponse?: FormResponseDto;
  draftFormResponse?: FormResponseDto | null;
  /** The fetch of `draftFormResponse`, when it is fetched. */
  guestDraftFetch?: DraftFetchState;
  initialPageIndex?: number;
  userDefaultPublic: boolean;
} & Pick<
  SchemaMaps,
  | "fieldLookup"
  | "defaultValueMap"
  | "outputFieldDefaultPublic"
  | "outputFieldIds"
  | "maxPageIndex"
>) {
  const storageKey = computeFormStorageKey({
    formId,
    instanceId: persistKey ?? undefined,
  });

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() => {
    if (initialPageIndex !== undefined && !persistKey) {
      return clampPageIndex(initialPageIndex, maxPageIndex);
    }
    if (readOnly) return 0;
    if (typeof window === "undefined" || !persistKey) return 0;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return 0;
    const stored = readStoredFormDraft({ raw, fieldLookup, outputFieldIds });
    return stored.ok
      ? clampPageIndex(stored.value.currentPageIndex ?? 0, maxPageIndex)
      : 0;
  });
  // Precedence: localStorage (active local edits) > draft (guest prefill, may
  // arrive after mount) > empty. Once either localStorage or a draft is applied,
  // we lock out later draft applies so we never stomp user edits.
  const draftLockedRef = useRef(false);
  const [edited, setEdited] = useState(false);
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      const answers =
        (completedFormResponse?.answers as Record<string, FormValue>) || {};
      return filterAnswersByFieldIds(answers, fieldLookup);
    }

    const readLocalStorageAnswers = (): Record<string, FormValue> | null => {
      if (typeof window === "undefined" || !persistKey) return null;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const stored = readStoredFormDraft({ raw, fieldLookup, outputFieldIds });
      const answers = stored.ok ? stored.value.answers : undefined;
      return answers && Object.keys(answers).length > 0 ? answers : null;
    };

    const localAnswers = readLocalStorageAnswers();
    if (localAnswers) {
      draftLockedRef.current = true;
      return applyDefaultValues(localAnswers, defaultValueMap);
    }

    const draftAnswers = draftFormResponse?.answers
      ? restorableAnswers(
          draftFormResponse.answers as Record<string, FormValue>,
          fieldLookup,
        )
      : null;
    if (draftAnswers && Object.keys(draftAnswers).length > 0) {
      draftLockedRef.current = true;
      return applyDefaultValues(draftAnswers, defaultValueMap);
    }

    return applyDefaultValues({}, defaultValueMap);
  });

  const [publicAnswerOverrides, setPublicAnswerOverrides] = useState<
    Partial<Record<string, boolean>>
  >({});
  const publicAnswers = useMemo(() => {
    if (readOnly && completedFormResponse?.publicAnswers) {
      return completedFormResponse.publicAnswers as Record<string, boolean>;
    }
    const resolved: Record<string, boolean> = {};
    for (const [fieldId, defaultPublic] of outputFieldDefaultPublic.entries()) {
      resolved[fieldId] = publicAnswerOverrides[fieldId] ?? defaultPublic;
    }
    return resolved;
  }, [
    readOnly,
    completedFormResponse?.publicAnswers,
    outputFieldDefaultPublic,
    publicAnswerOverrides,
  ]);

  // Seeded during the first render, before the persist effect below rewrites
  // the entry.
  const [syncedUpdatedAt, setSyncedUpdatedAt] = useState<string | null>(() => {
    if (readOnly || typeof window === "undefined" || !persistKey) return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const stored = readStoredFormDraft({ raw, fieldLookup, outputFieldIds });
    return (stored.ok && stored.value.syncedUpdatedAt) || null;
  });

  const draftSyncEnabled =
    !!syncDraftToServer && !readOnly && !!persistKey && formSnapshotId !== null;

  const {
    serverDraft,
    settled: serverDraftSettled,
    failed: serverDraftFailed,
    saveFailed,
    pauseSyncing,
    resumeSyncing,
  } = useFormDraftSync({
    enabled: draftSyncEnabled,
    formId,
    actionId,
    formSnapshotId,
    answers: formData,
    publicAnswers,
    currentPageIndex,
    edited,
    onSaved: setSyncedUpdatedAt,
  });

  useEffect(() => {
    if (!draftSyncEnabled || edited || !serverDraft) return;
    // Equal means the stored draft is this device's own last save. Both sides
    // are server-issued, so nothing here depends on the device's clock.
    if (serverDraft.updatedAt === syncedUpdatedAt) {
      return;
    }
    const answers = restorableAnswers(
      serverDraft.answers as Record<string, FormValue>,
      fieldLookup,
    );
    draftLockedRef.current = true;
    setFormData((prev) =>
      applyDefaultValues({ ...prev, ...answers }, defaultValueMap),
    );
    setPublicAnswerOverrides((prev) => ({
      ...prev,
      ...restorablePublicAnswers(serverDraft.publicAnswers, outputFieldIds),
    }));
    setCurrentPageIndex(
      clampPageIndex(serverDraft.currentPageIndex, maxPageIndex),
    );
  }, [
    serverDraft,
    draftSyncEnabled,
    edited,
    syncedUpdatedAt,
    fieldLookup,
    defaultValueMap,
    outputFieldIds,
  ]);

  const syncedDraftSettled = useDraftSettled({
    localDraftRead: true,
    fetchEnabled: draftSyncEnabled,
    fetchSettled: serverDraftSettled,
  });
  const guestDraftSettled = useDraftSettled({
    localDraftRead: true,
    fetchEnabled: guestDraftFetch !== undefined,
    fetchSettled: guestDraftFetch?.settled ?? true,
  });
  const draftSettled = syncedDraftSettled && guestDraftSettled;
  const draftFailed = serverDraftFailed || !!guestDraftFetch?.failed;

  // Applies a guest draft that arrives after mount, unless the member has
  // started editing or another draft was restored.
  useEffect(() => {
    if (readOnly) return;
    if (draftLockedRef.current) return;
    if (!draftFormResponse?.answers) return;
    const draftAnswers = restorableAnswers(
      draftFormResponse.answers as Record<string, FormValue>,
      fieldLookup,
    );
    if (Object.keys(draftAnswers).length === 0) return;
    draftLockedRef.current = true;
    setFormData(applyDefaultValues(draftAnswers, defaultValueMap));
  }, [draftFormResponse, readOnly, fieldLookup, defaultValueMap]);

  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      serializeStoredFormDraft({
        formData,
        publicAnswers: publicAnswerOverrides,
        currentPageIndex,
        syncedUpdatedAt,
      }),
    );
  }, [
    formData,
    publicAnswerOverrides,
    currentPageIndex,
    persistKey,
    storageKey,
    readOnly,
    syncedUpdatedAt,
  ]);

  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const stored = readStoredFormDraft({ raw, fieldLookup, outputFieldIds });
    if (!stored.ok) return;
    const { answers, publicAnswers, currentPageIndex } = stored.value;
    if (answers) {
      setFormData(applyDefaultValues(answers, defaultValueMap));
    }
    if (Object.keys(publicAnswers).length > 0) {
      setPublicAnswerOverrides((prev) => ({
        ...prev,
        ...publicAnswers,
      }));
    }
    if (currentPageIndex !== undefined) {
      setCurrentPageIndex(clampPageIndex(currentPageIndex, maxPageIndex));
    }
  }, [
    persistKey,
    readOnly,
    fieldLookup,
    storageKey,
    maxPageIndex,
    defaultValueMap,
    outputFieldIds,
  ]);

  useEffect(() => {
    if (!readOnly) return;
    if (completedFormResponse?.answers) {
      setFormData(
        filterAnswersByFieldIds(
          completedFormResponse.answers as Record<string, FormValue>,
          fieldLookup,
        ),
      );
    }
  }, [readOnly, completedFormResponse, fieldLookup]);

  useEffect(() => {
    if (
      initialPageIndex === undefined ||
      readOnly ||
      persistKey ||
      typeof initialPageIndex !== "number"
    ) {
      return;
    }
    setCurrentPageIndex(clampPageIndex(initialPageIndex, maxPageIndex));
  }, [initialPageIndex, persistKey, readOnly, maxPageIndex]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    setFormData((prev) => applyDefaultValues(prev, defaultValueMap));
  }, [defaultValueMap, readOnly]);

  const setPublicAnswer = (fieldId: string, nextPublic: boolean) => {
    const defaultPublic =
      outputFieldDefaultPublic.get(fieldId) ?? userDefaultPublic;
    setPublicAnswerOverrides((prev) => {
      if (nextPublic === defaultPublic) {
        if (!(fieldId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      if (prev[fieldId] === nextPublic) {
        return prev;
      }
      return {
        ...prev,
        [fieldId]: nextPublic,
      };
    });
  };

  const markEdited = () => {
    draftLockedRef.current = true;
    setEdited(true);
  };

  return {
    formData,
    setFormData,
    publicAnswers,
    setPublicAnswer,
    currentPageIndex,
    setCurrentPageIndex,
    edited,
    markEdited,
    /** Set once a draft synced from another device, and one left on a guest visit, have been restored, found absent, or failed to load. */
    draftSettled,
    /** Set while a draft fetch has failed or waits offline. */
    draftFailed,
    saveFailed,
    pauseSyncing,
    resumeSyncing,
  };
}
