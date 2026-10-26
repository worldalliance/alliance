import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  validateFormSchema,
  type FormSchemaValidationContext,
} from "@alliance/common/forms/form-schema-validate";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import { R, type Result } from "@alliance/common/result";
import {
  tasksGetFormAdmin,
  tasksUpdateFormAdmin,
  type FormDto,
} from "@alliance/shared/client";
import {
  useCreateFormAdmin,
  useInvalidateFormsAdmin,
} from "@alliance/shared/lib/useFormsAdmin";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useState } from "react";
import { isDraftValidatorId } from "../components/form-fields/customValidatorDrafts";
import {
  customValidatorIds,
  mapCustomValidatorIds,
} from "./customValidatorIds";
import { ensurePages } from "./ensureFormSchema";
import { mergeFormSchemas } from "./formSchemaMerge";
import { useCustomValidatorAdmin } from "./useCustomValidatorAdmin";
import type { CreatedValidator, useFormDraft } from "./useFormDraft";
import type { SavedForm } from "./useSavedForm";

export type DisplayOnlySaveConflict = {
  theirs: FormSchema;
  theirsSnapshotId: number;
};

export type DisplayOnlySaveResult = Result<
  { snapshotId: number },
  DisplayOnlySaveConflict
>;

export type DisplayOnlySave = (params: {
  schema: FormSchema;
  expectedSnapshotId: number | null;
}) => Promise<DisplayOnlySaveResult>;

const fetchTheirs = async (
  formId: number,
): Promise<Result<DisplayOnlySaveConflict, unknown>> => {
  const { data, error } = await tasksGetFormAdmin({ path: { id: formId } });
  if (!data) {
    console.error("Failed to load their version of the form:", error);
    return R.failure(error);
  }
  return R.success({
    theirs: ensurePages(data.schema as FormSchema),
    theirsSnapshotId: data.formSnapshotId,
  });
};

export function useFormSave({
  displayOnlySave,
  formId,
  newFormTitle,
  setFormId,
  formDraft,
  saved,
  sourceFormsLoading,
  validation,
  reloadEditors,
  onInvalid,
}: {
  displayOnlySave: DisplayOnlySave | null;
  formId: number | undefined;
  newFormTitle: string;
  setFormId: (formId: number) => void;
  formDraft: ReturnType<typeof useFormDraft>;
  saved: SavedForm;
  sourceFormsLoading: boolean;
  validation: FormSchemaValidationContext;
  reloadEditors: () => void;
  onInvalid: () => void;
}) {
  const {
    schema,
    amendSchema,
    endStep,
    loadSchema,
    validatorDrafts,
    resolveValidatorDrafts,
  } = formDraft;
  const {
    lastSavedSchemaJSON,
    baseFormSnapshotId,
    setBaseline,
    markSaved,
    navigateToSaved,
    conflict,
    setConflict,
  } = saved;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const invalidateForms = useInvalidateFormsAdmin();
  const { createForm } = useCreateFormAdmin();

  const { create: createValidator } = useCustomValidatorAdmin(null);
  const resolveCustomValidatorDrafts = useCallback(
    async (schemaToSave: FormSchema) => {
      const draftIds = [...customValidatorIds(schemaToSave)].filter(
        isDraftValidatorId,
      );

      const created = new Map<number, CreatedValidator>();
      if (draftIds.length === 0) {
        return { schema: schemaToSave, created };
      }

      await Promise.all(
        draftIds.map(async (draftId) => {
          const draft = validatorDrafts[draftId];
          if (!draft) {
            throw new Error("Missing custom validator draft configuration.");
          }
          created.set(draftId, { id: await createValidator(draft), draft });
        }),
      );

      const nextSchema = mapCustomValidatorIds(
        schemaToSave,
        (id) => created.get(id)?.id ?? id,
      );

      return { schema: nextSchema, created };
    },
    [validatorDrafts, createValidator],
  );

  const saveForm = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (sourceFormsLoading) {
        showErrorToast(
          "Still loading the questions of forms your formulas read. Try again in a moment.",
        );
        return;
      }

      // List inputs name sub-fields added since they were last saved, from
      // labels that are final by now.
      const syncedSchema = syncSchemaListInputs(schema, validation.sourceForms);
      amendSchema(syncedSchema);
      endStep();

      if (validateFormSchema(syncedSchema, validation).length > 0) {
        onInvalid();
        return;
      }

      const { schema: schemaForSave, created } =
        await resolveCustomValidatorDrafts(syncedSchema);
      if (created.size > 0) {
        resolveValidatorDrafts(created);
      }

      if (displayOnlySave) {
        const result = await displayOnlySave({
          schema: schemaForSave,
          expectedSnapshotId: baseFormSnapshotId,
        });
        if (R.isFailure(result)) {
          setConflict({
            base: JSON.parse(lastSavedSchemaJSON) as FormSchema,
            mine: schemaForSave,
            theirs: result.error.theirs,
            theirsSnapshotId: result.error.theirsSnapshotId,
          });
          showErrorToast("This update was changed by someone else");
          return;
        }
        markSaved(schemaForSave, result.value.snapshotId);
        showSuccessToast("Saved successfully");
        return;
      }

      let savedForm: FormDto;

      if (formId) {
        const response = await tasksUpdateFormAdmin({
          path: { formId },
          body: {
            schema: schemaForSave as unknown as Record<string, unknown>,
            expectedFormSnapshotId: baseFormSnapshotId ?? undefined,
          },
        });

        if (response.response.status === 409) {
          const theirs = await fetchTheirs(formId);
          if (R.isSuccess(theirs)) {
            setConflict({
              base: JSON.parse(lastSavedSchemaJSON) as FormSchema,
              mine: schemaForSave,
              ...theirs.value,
            });
          } else {
            setSaveError(
              "This form was changed by someone else. Reload to continue.",
            );
          }
          showErrorToast("This form was changed by someone else");
          return;
        }

        if (!response.response.ok || !response.data) {
          const fallbackMessage = "Could not save form";
          setSaveError(fallbackMessage);
          showErrorToast(fallbackMessage);
          return;
        }
        savedForm = response.data;
        void invalidateForms();
      } else {
        savedForm = await createForm({
          title: newFormTitle,
          schema: schemaForSave as unknown as Record<string, unknown>,
        });
      }

      const { id, formSnapshotId } = savedForm;
      markSaved(schemaForSave, formSnapshotId);
      navigateToSaved(id, () => setFormId(id));
      showSuccessToast("Form saved successfully");
    } catch (error) {
      console.error("Failed to save form:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Could not save form";
      setSaveError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [
    displayOnlySave,
    formId,
    baseFormSnapshotId,
    createForm,
    invalidateForms,
    lastSavedSchemaJSON,
    markSaved,
    navigateToSaved,
    newFormTitle,
    amendSchema,
    endStep,
    onInvalid,
    resolveCustomValidatorDrafts,
    resolveValidatorDrafts,
    schema,
    setConflict,
    setFormId,
    showErrorToast,
    showSuccessToast,
    sourceFormsLoading,
    validation,
  ]);

  const closeConflict = useCallback(() => setConflict(null), [setConflict]);

  // Overwrite only if their snapshot is still current.
  const handleKeepMine = useCallback(async () => {
    if (!conflict) return;
    if (displayOnlySave) {
      setIsSaving(true);
      setSaveError(null);
      try {
        const result = await displayOnlySave({
          schema: conflict.mine,
          expectedSnapshotId: conflict.theirsSnapshotId,
        });
        if (R.isFailure(result)) {
          setConflict({
            base: conflict.base,
            mine: conflict.mine,
            theirs: result.error.theirs,
            theirsSnapshotId: result.error.theirsSnapshotId,
          });
          showErrorToast("Someone saved again — review the latest changes");
          return;
        }
        amendSchema(conflict.mine);
        markSaved(conflict.mine, result.value.snapshotId);
        setConflict(null);
        showSuccessToast("Saved your version");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not save";
        setSaveError(message);
        showErrorToast(message);
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!formId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await tasksUpdateFormAdmin({
        path: { formId },
        body: {
          schema: conflict.mine as unknown as Record<string, unknown>,
          expectedFormSnapshotId: conflict.theirsSnapshotId,
        },
      });
      if (response.response.status === 409) {
        const theirs = await fetchTheirs(formId);
        if (R.isSuccess(theirs)) {
          setConflict({
            base: conflict.base,
            mine: conflict.mine,
            ...theirs.value,
          });
        }
        showErrorToast("Someone saved again — review the latest changes");
        return;
      }
      if (response.response.ok && response.data) {
        void invalidateForms();
        amendSchema(conflict.mine);
        markSaved(conflict.mine, response.data.formSnapshotId);
        setConflict(null);
        showSuccessToast("Saved your version");
      } else {
        setSaveError("Could not save form");
        showErrorToast("Could not save form");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save form";
      setSaveError(message);
      showErrorToast(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    conflict,
    displayOnlySave,
    formId,
    invalidateForms,
    amendSchema,
    markSaved,
    setConflict,
    showErrorToast,
    showSuccessToast,
  ]);

  const handleTakeTheirs = useCallback(() => {
    if (!conflict) return;
    if (
      !window.confirm(
        "Discard your changes and load their current version? Copy your version first if you want to keep it.",
      )
    ) {
      return;
    }
    loadSchema(conflict.theirs);
    reloadEditors();
    markSaved(conflict.theirs, conflict.theirsSnapshotId);
    setConflict(null);
  }, [conflict, loadSchema, markSaved, reloadEditors, setConflict]);

  const handleMerge = useCallback(() => {
    if (!conflict) return;
    const result = mergeFormSchemas({
      base: conflict.base,
      mine: conflict.mine,
      theirs: conflict.theirs,
      validation,
    });
    if (!result.ok) {
      showErrorToast("Can't auto-merge — there are conflicting edits");
      return;
    }
    loadSchema(result.value);
    reloadEditors();
    setBaseline(conflict.theirs, conflict.theirsSnapshotId);
    setConflict(null);
    showSuccessToast("Merged their changes with yours — review and save");
  }, [
    conflict,
    loadSchema,
    reloadEditors,
    setBaseline,
    setConflict,
    showErrorToast,
    showSuccessToast,
    validation,
  ]);

  const handleCopyMine = useCallback(async () => {
    if (!conflict) return;
    if (await copyToClipboard(JSON.stringify(conflict.mine, null, 2))) {
      showSuccessToast("Copied your version to the clipboard");
    } else {
      showErrorToast("Could not copy your version to the clipboard");
    }
  }, [conflict, showErrorToast, showSuccessToast]);

  return {
    saveForm,
    isSaving,
    saveError,
    closeConflict,
    handleKeepMine,
    handleTakeTheirs,
    handleMerge,
    handleCopyMine,
  };
}
