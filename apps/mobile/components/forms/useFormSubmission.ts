import {
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type SubmitFormDto } from "@alliance/shared/client";
import { filterAnswersByFieldIds } from "@alliance/shared/forms/formDrafts";
import { formulaSourcesFor } from "@alliance/shared/forms/formulaChoices";
import { stripCardIds } from "@alliance/shared/forms/listCards";
import { type SourceHistories } from "@alliance/shared/forms/useVariableSourceHistories";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { useState } from "react";
import { DEVICE_TYPE } from "./deviceType";

export function useFormSubmission({
  readOnly,
  uploadingImages,
  onSubmit,
  onAbandonAction,
  formSnapshotId,
  actionId,
  schema,
  sourceHistories,
  visibilityValidatorResults,
  fieldLookup,
  formData,
  effectiveFormData,
  publicAnswers,
  phDistinctId,
  sessionReplayUrl,
  readyToSubmit,
  pauseSyncing,
  resumeSyncing,
  clearStoredDraft,
}: {
  readOnly: boolean;
  uploadingImages: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  formSnapshotId: number | null;
  actionId: number;
  schema: FormSchema;
  sourceHistories: SourceHistories;
  visibilityValidatorResults: Record<number, boolean>;
  fieldLookup: Map<string, AnyField>;
  formData: Record<string, FormValue>;
  effectiveFormData: Record<string, FormValue>;
  publicAnswers: Record<string, boolean>;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  readyToSubmit: () => Promise<boolean>;
  pauseSyncing: () => void;
  resumeSyncing: () => void;
  clearStoredDraft: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const payloadFor = (
    answers: Record<string, FormValue>,
    snapshotId: number,
  ): SubmitFormDto => ({
    answers: stripCardIds(answers),
    formSnapshotId: snapshotId,
    actionId,
    formulaSources: formulaSourcesFor(schema, sourceHistories),
    visibilityValidatorResults,
    deviceType: DEVICE_TYPE,
    publicAnswers,
  });

  const handleSubmit = async () => {
    if (submitting || readOnly || uploadingImages) {
      return;
    }
    if (onSubmit && formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }
    setSubmitting(true);

    if (!(await readyToSubmit())) {
      setSubmitting(false);
      return;
    }

    if (!onSubmit || formSnapshotId === null) {
      setSubmitting(false);
      return;
    }

    const submissionPayload: SubmitFormDto = {
      ...payloadFor(
        filterAnswersByFieldIds(effectiveFormData, fieldLookup),
        formSnapshotId,
      ),
      phDistinctId,
      sessionReplayUrl,
    };

    pauseSyncing();
    onSubmit(submissionPayload)
      .then((submitted) => {
        if (!submitted) {
          resumeSyncing();
          return;
        }
        clearStoredDraft();
      })
      .catch(() => resumeSyncing())
      .finally(() => {
        setSubmitting(false);
      });
  };

  const handleAbandon = (choice: Omit<ActionWithdrawal, "partialFormData">) => {
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required to abandon a form",
      );
    }
    pauseSyncing();
    onAbandonAction?.({
      ...choice,
      partialFormData: payloadFor(formData, formSnapshotId),
    });
  };

  return { submitting, handleSubmit, handleAbandon };
}
