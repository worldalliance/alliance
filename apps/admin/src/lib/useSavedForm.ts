import type { FormPlace } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormLinkedActionDto } from "@alliance/shared/client";
import { useAdminTaskFormActions } from "@alliance/shared/lib/useTaskForm";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminRefusalMessage } from "./adminRefusal";
import { ensurePages } from "./ensureFormSchema";
import { placeForSelect } from "./formDependencies";
import { useSelectOnLoad } from "./formEditorLink";
import { useLeaveGuard } from "./useLeaveGuard";

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
  const [usedInAction, setUsedInAction] = useState<FormLinkedActionDto>();
  const [isLoading, setIsLoading] = useState(
    () => !displayOnly && Boolean(formId) && !initialSchema,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { error: showErrorToast } = useToast();
  const { fetchLatest } = useAdminTaskFormActions();

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

    const fail = (error: unknown) => {
      console.error("Failed to load form:", error);
      setLoadError(adminRefusalMessage(error, "Failed to load form"));
    };
    fetchLatest(formId)
      .then((read) => {
        if (!read.ok) {
          fail(read.error);
          return;
        }
        const form = read.value;
        setUsedInAction(form.usedInAction);
        if (form.schema) {
          const nextSchema = ensurePages(form.schema as FormSchema);
          loadSchema(nextSchema);
          reloadEditors();
          const selectOnLoad = selectOnLoadRef.current;
          selectOnLoadRef.current = null;
          if (selectOnLoad !== null) {
            const place = placeForSelect(nextSchema.pages, selectOnLoad);
            if (place) {
              selectPlace(place);
            } else {
              showErrorToast(
                `This form has no page or element "${selectOnLoad}"`,
              );
            }
          }
          markSaved(nextSchema, form.formSnapshotId);
        }
      })
      .catch(fail)
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    displayOnly,
    fetchLatest,
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

  const navigateUnprompted = useLeaveGuard(hasUnsavedChanges);

  /** Runs `navigate` to the form a save created or updated, without reloading it. */
  const navigateToSaved = useCallback(
    (savedFormId: number, navigate: () => void) => {
      if (savedFormId !== formId) {
        createdFormIdRef.current = savedFormId;
      }
      navigateUnprompted(navigate);
    },
    [formId, navigateUnprompted],
  );

  return {
    /** The action whose task form, or task form variant, the loaded form is. */
    usedInAction,
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
