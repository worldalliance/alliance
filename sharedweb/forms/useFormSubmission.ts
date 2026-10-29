import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
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
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router";

type FormValidation = ReturnType<typeof useFormValidation>;

export function useFormSubmission({
  readOnly,
  onSubmit,
  onAbandonAction,
  formSnapshotId,
  actionId,
  schema,
  sourceHistories,
  visibilityValidatorResults,
  deviceType,
  fieldLookup,
  formData,
  effectiveFormData,
  publicAnswers,
  phDistinctId,
  sessionReplayUrl,
  uploadingImages,
  visibilitySettled,
  currentPageIndex,
  setCurrentPageIndex,
  nextVisiblePageIndex,
  previousVisiblePageIndex,
  validatePage,
  validateAllPages,
  focusInvalidField,
  trackValidationError,
  pauseSyncing,
  resumeSyncing,
}: {
  readOnly: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  formSnapshotId: number | null;
  actionId: number;
  schema: FormSchema;
  sourceHistories: SourceHistories;
  visibilityValidatorResults: Record<number, boolean>;
  deviceType: DeviceVisibilityTarget;
  fieldLookup: Map<string, AnyField>;
  formData: Record<string, FormValue>;
  effectiveFormData: Record<string, FormValue>;
  publicAnswers: Record<string, boolean>;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  uploadingImages: boolean;
  visibilitySettled: boolean;
  currentPageIndex: number;
  setCurrentPageIndex: (pageIndex: number) => void;
  nextVisiblePageIndex: number | null;
  previousVisiblePageIndex: number | null;
  validatePage: FormValidation["validatePage"];
  validateAllPages: FormValidation["validateAllPages"];
  focusInvalidField: (fieldId: string | undefined) => void;
  trackValidationError: (fieldId: string | undefined) => void;
  pauseSyncing: () => void;
  resumeSyncing: () => void;
}) {
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // Guard against double-submit when the submit button's click handler
  // (ConfettiWrapper) and the form's submit event both submit.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // The form is `noValidate` so its own errors come first, in field order;
  // the browser then checks what they don't cover, such as email syntax.
  const reportNativeValidity = useCallback(
    () => formRef.current?.reportValidity() !== false,
    [],
  );

  const showInvalid = useCallback(
    (fieldId: string | undefined) => {
      focusInvalidField(fieldId);
      trackValidationError(fieldId);
    },
    [focusInvalidField, trackValidationError],
  );

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (readOnly) {
      if (nextVisiblePageIndex !== null) {
        setCurrentPageIndex(nextVisiblePageIndex);
      }
      return;
    }

    // File fields receive their stored answer only after the upload finishes,
    // so validation must wait too.
    if (uploadingImages || !visibilitySettled) return;

    if (nextVisiblePageIndex !== null) {
      const result = await validatePage(currentPageIndex, true);
      if (!result.isValid) {
        showInvalid(result.firstInvalidFieldId);
        return;
      }
      if (!reportNativeValidity()) return;
      setCurrentPageIndex(nextVisiblePageIndex);
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (previousVisiblePageIndex !== null) {
      setCurrentPageIndex(previousVisiblePageIndex);
    }
  };

  const validateAllPagesAndShowFirstInvalid = useCallback(async () => {
    const result = await validateAllPages();
    if (!result.isValid && typeof result.firstInvalidPageIndex === "number") {
      setCurrentPageIndex(result.firstInvalidPageIndex);
      focusInvalidField(result.firstInvalidFieldId);
    }
    return result;
  }, [validateAllPages]);

  /** Whether a submit or page check may start now; one at a time. */
  const canSubmit = useCallback((): boolean => {
    if (submittingRef.current || readOnly || !onSubmit || uploadingImages) {
      return false;
    }
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }
    return true;
  }, [formSnapshotId, onSubmit, readOnly, uploadingImages]);

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    if (!canSubmit() || !onSubmit || formSnapshotId === null) {
      return NOT_SUBMITTED;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { isValid, firstInvalidFieldId, firstInvalidPageIndex } =
        await validateAllPagesAndShowFirstInvalid();
      if (!isValid) {
        trackValidationError(firstInvalidFieldId);
        return { submitted: false, firstInvalidPageIndex };
      }
      if (!reportNativeValidity()) {
        return NOT_SUBMITTED;
      }

      const sanitizedAnswers = stripCardIds(
        filterAnswersByFieldIds(effectiveFormData, fieldLookup),
      );

      const sid = searchParams.get("sid") ?? searchParams.get("ref");

      const submissionPayload: SubmitFormDto = {
        answers: sanitizedAnswers,
        formSnapshotId,
        actionId,
        formulaSources: formulaSourcesFor(schema, sourceHistories),
        visibilityValidatorResults,
        deviceType,
        publicAnswers,
        phDistinctId,
        sessionReplayUrl,
        sid: sid ?? undefined,
      };

      pauseSyncing();
      try {
        const submitted = await onSubmit(submissionPayload);
        if (!submitted) {
          resumeSyncing();
        }
        return { submitted, firstInvalidPageIndex: null };
      } catch {
        resumeSyncing();
        return NOT_SUBMITTED;
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    actionId,
    canSubmit,
    deviceType,
    effectiveFormData,
    fieldLookup,
    formSnapshotId,
    onSubmit,
    phDistinctId,
    reportNativeValidity,
    publicAnswers,
    schema,
    searchParams,
    sourceHistories,
    sessionReplayUrl,
    trackValidationError,
    validateAllPagesAndShowFirstInvalid,
    visibilityValidatorResults,
    pauseSyncing,
    resumeSyncing,
  ]);

  const submitCurrentPage = useCallback(async (): Promise<boolean> => {
    if (nextVisiblePageIndex === null) {
      return (await submit()).submitted;
    }
    if (!visibilitySettled || !canSubmit()) return false;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await validatePage(currentPageIndex, true);
      if (!result.isValid) {
        showInvalid(result.firstInvalidFieldId);
      } else if (reportNativeValidity()) {
        setCurrentPageIndex(nextVisiblePageIndex);
      }
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    canSubmit,
    currentPageIndex,
    nextVisiblePageIndex,
    reportNativeValidity,
    showInvalid,
    submit,
    validatePage,
    visibilitySettled,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await submitCurrentPage();
  };

  const handleAbandon = (choice: Omit<ActionWithdrawal, "partialFormData">) => {
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required to abandon a form",
      );
    }
    const submissionPayload: SubmitFormDto = {
      answers: stripCardIds(formData),
      formSnapshotId,
      actionId,
      formulaSources: formulaSourcesFor(schema, sourceHistories),
      visibilityValidatorResults,
      deviceType,
      publicAnswers,
    };

    pauseSyncing();
    onAbandonAction?.({ ...choice, partialFormData: submissionPayload });
  };

  return {
    formRef,
    submitting,
    handleNext,
    handlePrevious,
    validateAllPagesAndShowFirstInvalid,
    submit,
    submitCurrentPage,
    handleSubmit,
    handleAbandon,
  };
}
