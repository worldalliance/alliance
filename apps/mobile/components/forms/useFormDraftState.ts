import { type FormValue } from "@alliance/common/forms/form-schema";
import { type FormResponseDto } from "@alliance/shared/client";
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
import {
  useFormDraftSync,
  type useFormSchemaMaps,
} from "@alliance/shared/useFormRenderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  initialPageIndex,
  edited,
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
  initialPageIndex?: number;
  edited: boolean;
} & Pick<
  SchemaMaps,
  | "fieldLookup"
  | "defaultValueMap"
  | "outputFieldDefaultPublic"
  | "outputFieldIds"
  | "maxPageIndex"
>) {
  const storageKey = useMemo(
    () =>
      computeFormStorageKey({
        formId,
        instanceId: persistKey ?? undefined,
      }),
    [formId, persistKey],
  );

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() =>
    clampPageIndex(initialPageIndex ?? 0, maxPageIndex),
  );
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      const answers =
        (completedFormResponse?.answers as Record<string, FormValue>) || {};
      return filterAnswersByFieldIds(answers, fieldLookup);
    }
    return applyDefaultValues({}, defaultValueMap);
  });
  const [publicAnswers, setPublicAnswers] = useState<Record<string, boolean>>(
    () => {
      const completedPublicAnswers = completedFormResponse?.publicAnswers as
        | Record<string, unknown>
        | undefined;
      const defaults: Record<string, boolean> = {};
      for (const [fieldId, defaultIsPublic] of outputFieldDefaultPublic) {
        const completedValue = completedPublicAnswers?.[fieldId];
        defaults[fieldId] =
          typeof completedValue === "boolean"
            ? completedValue
            : defaultIsPublic;
      }
      return defaults;
    },
  );

  // The save effect waits for the stored draft to load, so it doesn't
  // overwrite stored data with initial defaults.
  const draftLoaded = useRef(false);
  // The server-draft apply below waits on `localDraftRead`, because a device
  // that has never synced and one whose local read hasn't finished both have
  // a null `syncedUpdatedAt`.
  const [localDraftRead, setLocalDraftRead] = useState(false);
  const [syncedUpdatedAt, setSyncedUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (readOnly || !persistKey) {
      draftLoaded.current = true;
      setLocalDraftRead(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled || !raw) {
          draftLoaded.current = true;
          setLocalDraftRead(true);
          return;
        }
        const stored = readStoredFormDraft({
          raw,
          fieldLookup,
          outputFieldIds,
        });
        if (stored.ok) {
          const { answers, publicAnswers, currentPageIndex, syncedUpdatedAt } =
            stored.value;
          if (syncedUpdatedAt !== undefined) {
            setSyncedUpdatedAt(syncedUpdatedAt);
          }
          if (answers) {
            setFormData(applyDefaultValues(answers, defaultValueMap));
          }
          if (Object.keys(publicAnswers).length > 0) {
            setPublicAnswers((prev) => ({ ...prev, ...publicAnswers }));
          }
          if (currentPageIndex !== undefined) {
            setCurrentPageIndex(clampPageIndex(currentPageIndex, maxPageIndex));
          }
        }
      } catch {
        // A storage read that throws starts the form without a draft.
      }
      draftLoaded.current = true;
      setLocalDraftRead(true);
    })();

    return () => {
      cancelled = true;
    };
    // Only run once on mount for a given storageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const draftSyncEnabled =
    !!syncDraftToServer && !readOnly && !!persistKey && formSnapshotId !== null;

  const { serverDraft, saveFailed, pauseSyncing, resumeSyncing } =
    useFormDraftSync({
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
    if (!localDraftRead) return;
    // Equal means the stored draft is this device's own last save. Both sides
    // are server-issued, so nothing here depends on the device's clock.
    if (serverDraft.updatedAt === syncedUpdatedAt) {
      return;
    }
    const answers = restorableAnswers(
      serverDraft.answers as Record<string, FormValue>,
      fieldLookup,
    );
    setFormData((prev) =>
      applyDefaultValues({ ...prev, ...answers }, defaultValueMap),
    );
    setPublicAnswers((prev) => ({
      ...prev,
      ...restorablePublicAnswers(serverDraft.publicAnswers, outputFieldIds),
    }));
    setCurrentPageIndex(
      clampPageIndex(serverDraft.currentPageIndex, maxPageIndex),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverDraft,
    draftSyncEnabled,
    edited,
    localDraftRead,
    syncedUpdatedAt,
    fieldLookup,
    defaultValueMap,
    outputFieldIds,
  ]);

  useEffect(() => {
    if (readOnly || !persistKey || !draftLoaded.current) return;

    const timeout = setTimeout(() => {
      AsyncStorage.setItem(
        storageKey,
        serializeStoredFormDraft({
          formData,
          publicAnswers,
          currentPageIndex,
          syncedUpdatedAt,
        }),
      ).catch((e) => {
        console.error("Failed to save draft", e);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [
    formData,
    publicAnswers,
    currentPageIndex,
    persistKey,
    storageKey,
    readOnly,
    syncedUpdatedAt,
  ]);

  useEffect(() => {
    const completedPublicAnswers = completedFormResponse?.publicAnswers as
      | Record<string, unknown>
      | undefined;

    setPublicAnswers((prev) => {
      const next: Record<string, boolean> = {};
      for (const [fieldId, defaultIsPublic] of outputFieldDefaultPublic) {
        const completedValue = completedPublicAnswers?.[fieldId];
        const fallbackValue =
          typeof completedValue === "boolean"
            ? completedValue
            : (prev[fieldId] ?? defaultIsPublic);
        next[fieldId] = fallbackValue;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        return next;
      }
      for (const key of nextKeys) {
        if (prev[key] !== next[key]) {
          return next;
        }
      }
      return prev;
    });
  }, [completedFormResponse?.publicAnswers, outputFieldDefaultPublic]);

  const clearStoredDraft = () => {
    if (persistKey) {
      AsyncStorage.removeItem(storageKey).catch(() => {});
    }
  };

  return {
    formData,
    setFormData,
    publicAnswers,
    setPublicAnswers,
    currentPageIndex,
    setCurrentPageIndex,
    saveFailed,
    pauseSyncing,
    resumeSyncing,
    clearStoredDraft,
  };
}
