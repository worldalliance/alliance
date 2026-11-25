import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  validateFormSchema,
  type FormSchemaValidationContext,
} from "@alliance/common/forms/form-schema-validate";
import { syncSchemaListInputs } from "@alliance/common/forms/variable-scope";
import { isDraftValidatorId } from "@alliance/common/forms/visible-if-formula";
import { R, type Result } from "@alliance/common/result";
import { type FormDto } from "@alliance/shared/client";
import { useCreateFormAdmin } from "@alliance/shared/lib/useFormsAdmin";
import {
  FormUpdateFailure,
  useAdminTaskFormActions,
} from "@alliance/shared/lib/useTaskForm";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useCallback, useState } from "react";
import { useToast } from "../ui/ToastProvider";
import { SAVE_FAILED_FALLBACK } from "../ui/templates/Form";
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

const SAVED_AGAIN = "Someone saved again. Review their latest changes.";

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
  const { success: showSuccessToast, confirm } = useToast();
  const { createForm } = useCreateFormAdmin();
  const { fetchLatest, updateForm } = useAdminTaskFormActions();
  const fetchTheirs = useCallback(
    async (
      formId: number,
    ): Promise<Result<DisplayOnlySaveConflict, unknown>> => {
      const fetched = await fetchLatest(formId);
      if (!fetched.ok) {
        console.error(
          "Failed to load their version of the form:",
          fetched.error,
        );
      }
      return R.map(fetched, (data) => ({
        theirs: ensurePages(data.schema as FormSchema),
        theirsSnapshotId: data.formSnapshotId,
      }));
    },
    [fetchLatest],
  );

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
        setSaveError(
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
          return;
        }
        markSaved(schemaForSave, result.value.snapshotId);
        showSuccessToast("Content saved");
        return;
      }

      let savedForm: FormDto;

      if (formId) {
        const result = await updateForm({
          formId,
          body: {
            schema: schemaForSave as unknown as Record<string, unknown>,
            expectedFormSnapshotId: baseFormSnapshotId ?? undefined,
          },
        });

        if (!result.ok && result.error === FormUpdateFailure.Conflict) {
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
          return;
        }

        if (!result.ok) {
          setSaveError(SAVE_FAILED_FALLBACK);
          return;
        }
        savedForm = result.value;
      } else {
        savedForm = await createForm({
          title: newFormTitle,
          schema: schemaForSave as unknown as Record<string, unknown>,
        });
      }

      const { id, formSnapshotId } = savedForm;
      markSaved(schemaForSave, formSnapshotId);
      navigateToSaved(id, () => setFormId(id));
      showSuccessToast("Form saved");
    } catch (error) {
      console.error("Failed to save form:", error);
      setSaveError(
        error instanceof Error ? error.message : SAVE_FAILED_FALLBACK,
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    displayOnlySave,
    formId,
    baseFormSnapshotId,
    createForm,
    fetchTheirs,
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
    showSuccessToast,
    sourceFormsLoading,
    updateForm,
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
          setSaveError(SAVED_AGAIN);
          return;
        }
        amendSchema(conflict.mine);
        markSaved(conflict.mine, result.value.snapshotId);
        setConflict(null);
        showSuccessToast("Saved your version");
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : SAVE_FAILED_FALLBACK,
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (!formId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await updateForm({
        formId,
        body: {
          schema: conflict.mine as unknown as Record<string, unknown>,
          expectedFormSnapshotId: conflict.theirsSnapshotId,
        },
      });
      if (!result.ok && result.error === FormUpdateFailure.Conflict) {
        const theirs = await fetchTheirs(formId);
        if (R.isSuccess(theirs)) {
          setConflict({
            base: conflict.base,
            mine: conflict.mine,
            ...theirs.value,
          });
        }
        setSaveError(SAVED_AGAIN);
        return;
      }
      if (result.ok) {
        amendSchema(conflict.mine);
        markSaved(conflict.mine, result.value.formSnapshotId);
        setConflict(null);
        showSuccessToast("Saved your version");
      } else {
        setSaveError(SAVE_FAILED_FALLBACK);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : SAVE_FAILED_FALLBACK,
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    conflict,
    displayOnlySave,
    formId,
    fetchTheirs,
    updateForm,
    amendSchema,
    markSaved,
    setConflict,
    showSuccessToast,
  ]);

  const handleTakeTheirs = useCallback(async () => {
    if (!conflict) return;
    const discard = await confirm({
      title: "Discard your changes?",
      message:
        "Their current version loads in place of yours. Copy your version first if you want to keep it.",
      confirmLabel: "Discard my changes",
      destructive: true,
    });
    if (!discard) return;
    setSaveError(null);
    loadSchema(conflict.theirs);
    reloadEditors();
    markSaved(conflict.theirs, conflict.theirsSnapshotId);
    setConflict(null);
  }, [confirm, conflict, loadSchema, markSaved, reloadEditors, setConflict]);

  const handleMerge = useCallback(() => {
    if (!conflict) return;
    const result = mergeFormSchemas({
      base: conflict.base,
      mine: conflict.mine,
      theirs: conflict.theirs,
      validation,
    });
    if (!result.ok) {
      setSaveError(
        "Can't merge automatically: you both changed the same things.",
      );
      return;
    }
    loadSchema(result.value);
    reloadEditors();
    setBaseline(conflict.theirs, conflict.theirsSnapshotId);
    setSaveError(null);
    setConflict(null);
    showSuccessToast("Merged their changes with yours. Review and save.");
  }, [
    conflict,
    loadSchema,
    reloadEditors,
    setBaseline,
    setConflict,
    showSuccessToast,
    validation,
  ]);

  const handleCopyMine = useCallback(async () => {
    if (!conflict) return;
    if (await copyToClipboard(JSON.stringify(conflict.mine, null, 2))) {
      showSuccessToast("Copied your version to the clipboard");
    } else {
      setSaveError("Couldn't copy your version.");
    }
  }, [conflict, showSuccessToast]);

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
