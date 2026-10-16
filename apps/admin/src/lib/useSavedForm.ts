import type { FormPlace } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { tasksGetForm } from "@alliance/shared/client";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router";
import { adminRefusalMessage } from "./adminRefusal";
import { ensurePages } from "./ensureFormSchema";
import { findQuestion } from "./formDependencies";
import { useSelectOnLoad } from "./formEditorLink";

type FormConflict = {
  base: FormSchema;
  mine: FormSchema;
  theirs: FormSchema;
  theirsSnapshotId: number;
};

export function useSavedForm({
  displayOnly,
  formId,
  initialSchema,
  initialSnapshotId,
  buildInitialSchema,
  schema,
  loadSchema,
  reloadEditors,
  selectPlace,
}: {
  displayOnly: boolean;
  formId: number | undefined;
  initialSchema: FormSchema | undefined;
  initialSnapshotId: number | null;
  buildInitialSchema: () => FormSchema;
  schema: FormSchema;
  loadSchema: (schema: FormSchema) => void;
  reloadEditors: () => void;
  selectPlace: (place: FormPlace) => void;
}) {
  const [lastSavedSchemaJSON, setLastSavedSchemaJSON] = useState<string>(() =>
    JSON.stringify(buildInitialSchema()),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [baseFormSnapshotId, setBaseFormSnapshotId] = useState<number | null>(
    initialSnapshotId,
  );
  const [conflict, setConflict] = useState<FormConflict | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { error: showErrorToast } = useToast();

  // A new form's first save already holds the saved schema; refetching it
  // would regroup and drop the admin's manual group boundaries.
  const createdFormIdRef = useRef<number | null>(null);
  const selectOnLoadRef = useSelectOnLoad();

  const setBaseline = useCallback(
    (saved: FormSchema, snapshotId: number | null) => {
      setLastSavedSchemaJSON(JSON.stringify(saved));
      setBaseFormSnapshotId(snapshotId);
    },
    [],
  );
  const markSaved = useCallback(
    (saved: FormSchema, snapshotId: number | null) => {
      setBaseline(saved, snapshotId);
      setHasUnsavedChanges(false);
    },
    [setBaseline],
  );

  useEffect(() => {
    if (displayOnly || !formId || initialSchema) return;
    if (createdFormIdRef.current === formId) {
      createdFormIdRef.current = null;
      return;
    }
    setIsLoading(true);
    setLoadError(null);

    tasksGetForm({ path: { id: formId }, throwOnError: true })
      .then((response) => {
        const form = response.data;
        if (form?.schema) {
          const nextSchema = ensurePages(form.schema as FormSchema);
          loadSchema(nextSchema);
          reloadEditors();
          const selectOnLoad = selectOnLoadRef.current;
          selectOnLoadRef.current = null;
          if (selectOnLoad !== null) {
            const place = findQuestion(nextSchema.pages, selectOnLoad);
            if (place) {
              selectPlace(place);
            } else {
              showErrorToast(`This form has no question "${selectOnLoad}"`);
            }
          }
          markSaved(nextSchema, form.formSnapshotId);
        }
      })
      .catch((error) => {
        console.error("Failed to load form:", error);
        setLoadError(adminRefusalMessage(error, "Failed to load form"));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    displayOnly,
    formId,
    initialSchema,
    loadAttempt,
    loadSchema,
    markSaved,
    reloadEditors,
    selectOnLoadRef,
    selectPlace,
    showErrorToast,
  ]);

  useEffect(() => {
    const currentSchemaJSON = JSON.stringify(schema);
    setHasUnsavedChanges(currentSchemaJSON !== lastSavedSchemaJSON);
  }, [schema, lastSavedSchemaJSON]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [hasUnsavedChanges],
    ),
  );

  /** Bypasses the blocker while `navigateToSaved`'s navigation still sees stale dirty state. */
  const skipNavigationBlockRef = useRef(false);
  const navigationBlocker = useBlocker(
    useCallback(
      () => hasUnsavedChanges && !skipNavigationBlockRef.current,
      [hasUnsavedChanges],
    ),
  );

  useEffect(() => {
    if (navigationBlocker.state === "blocked") {
      const confirmExit = window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?",
      );

      if (confirmExit) {
        navigationBlocker.proceed?.();
      } else {
        navigationBlocker.reset?.();
      }
    }
  }, [navigationBlocker]);

  /** Runs `navigate` to the form a save created or updated, without reloading it. */
  const navigateToSaved = useCallback(
    (savedFormId: number, navigate: () => void) => {
      skipNavigationBlockRef.current = true;
      if (savedFormId !== formId) {
        createdFormIdRef.current = savedFormId;
      }
      navigate();
      skipNavigationBlockRef.current = false;
    },
    [formId],
  );

  return {
    lastSavedSchemaJSON,
    hasUnsavedChanges,
    baseFormSnapshotId,
    setBaseline,
    markSaved,
    navigateToSaved,
    conflict,
    setConflict,
    isLoading,
    loadError,
    retryLoad: () => setLoadAttempt((count) => count + 1),
  };
}

export type SavedForm = ReturnType<typeof useSavedForm>;
