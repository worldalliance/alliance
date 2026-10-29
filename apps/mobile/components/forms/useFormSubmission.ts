import {
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type SubmitFormDto } from "@alliance/shared/client";
import { filterAnswersByFieldIds } from "@alliance/shared/forms/formDrafts";
import { formulaSourcesFor } from "@alliance/shared/forms/formulaChoices";
import { stripCardIds } from "@alliance/shared/forms/listCards";
import {
  NOT_SUBMITTED,
  type SubmitOutcome,
} from "@alliance/shared/forms/submitOutcome";
import { type useFormValidation } from "@alliance/shared/forms/useFormValidation";
import { type SourceHistories } from "@alliance/shared/forms/useVariableSourceHistories";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { useState } from "react";
import { DEVICE_TYPE } from "./deviceType";
import { submitForm } from "./submitForm";

type FormValidation = ReturnType<typeof useFormValidation>;

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
  validateAllPages,
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
  validateAllPages: FormValidation["validateAllPages"];
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

  const submit = async (): Promise<SubmitOutcome> => {
    if (submitting || readOnly || uploadingImages) {
      return NOT_SUBMITTED;
    }
    if (onSubmit && formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }
    const payload =
      onSubmit && formSnapshotId !== null
        ? {
            ...payloadFor(
              filterAnswersByFieldIds(effectiveFormData, fieldLookup),
              formSnapshotId,
            ),
            phDistinctId,
            sessionReplayUrl,
          }
        : null;
    setSubmitting(true);
    try {
      return await submitForm({
        validateAllPages,
        send: onSubmit && payload ? () => onSubmit(payload) : null,
        pauseSyncing,
        resumeSyncing,
        clearStoredDraft,
      });
    } finally {
      setSubmitting(false);
    }
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

  return { submitting, submit, handleAbandon };
}
