import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  FormResponseDto,
  SubmitFormDto,
  type UserDto,
} from "@alliance/shared/client";
import { computeActiveUserKey } from "@alliance/shared/formrenderer";
import { completedFormSchema } from "@alliance/shared/forms/formulaChoices";
import { prefillListsFromPreviousAnswers } from "@alliance/shared/forms/listPrefill";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import {
  useFieldErrors,
  useFormValidation,
} from "@alliance/shared/forms/useFormValidation";
import { variableInputsGate } from "@alliance/shared/forms/variableInputsGate";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import {
  deviceTimeZone,
  formTimeZoneDefault,
} from "@alliance/shared/lib/timeZone";
import {
  useFormVisibility,
  useRandomizationKey,
} from "@alliance/shared/useFormRenderer";
import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  useFormPageDurationTracking,
  useFormValidationErrorTracking,
} from "./formAnalytics";
import { useDeviceType } from "./useDeviceType";
import { useFormDraftState } from "./useFormDraftState";
import { useFormEditing } from "./useFormEditing";
import { useFormInputs } from "./useFormInputs";
import { useFormScroll } from "./useFormScroll";
import { useFormSubmission } from "./useFormSubmission";

export type WebFormStateParams = {
  form: FormSchema;
  id: number;
  formSnapshotId: number | null;
  actionId: number;
  persistKey?: string | null;
  initialPageIndex?: number;
  userId?: string | number;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  user?: Omit<UserDto, "email">;
  /**
   * Whether `user` is still being fetched. Formulas reading other forms wait
   * for it.
   */
  userLoading?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Prefill form with these answers when there is no locally-persisted draft. Used to restore a guest's answers after signup. */
  draftFormResponse?: FormResponseDto | null;
  /** Save progress to the member's account as well as this device, so the form can be finished elsewhere. */
  syncDraftToServer?: boolean;
  /** When set, previousAnswer blocks fetch this user's responses via the admin all-responses endpoint. */
  adminPreviewUserId?: string | number;
  /** When true, fetch the logged-in viewer's saved city for userLocation display blocks. */
  loadCurrentUserLocation?: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null; // null for admin preview
  scrollContainerRef?: RefObject<HTMLElement | null>;
};

export function useWebFormState({
  form,
  id,
  formSnapshotId,
  actionId,
  persistKey,
  initialPageIndex,
  userId,
  phDistinctId,
  sessionReplayUrl,
  user,
  userLoading = false,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
  draftFormResponse,
  syncDraftToServer,
  adminPreviewUserId,
  loadCurrentUserLocation,
  onSubmit,
  scrollContainerRef,
}: WebFormStateParams) {
  const readOnly = !!renderFormAsCompleted;
  const schema = useMemo(
    () =>
      completedFormSchema(form, readOnly ? completedFormResponse : undefined),
    [form, readOnly, completedFormResponse],
  );
  const activeUserKey = useMemo(
    () => computeActiveUserKey(user?.id, userId),
    [user?.id, userId],
  );
  const randomizationKey = useRandomizationKey({
    formId: id,
    activeUserKey,
    persistKey,
  });

  const userDefaultPublic = user?.formDataPreference === "public";
  const [detectedTimeZone] = useState(deviceTimeZone);
  const timeZone = formTimeZoneDefault({
    saved: user?.timeZone,
    device: detectedTimeZone,
  });
  const {
    fieldLookup,
    defaultValueMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    maxPageIndex,
  } = useFormSchemaMaps({ schema, userDefaultPublic, timeZone });

  const {
    formData,
    setFormData,
    publicAnswers,
    setPublicAnswer,
    currentPageIndex,
    setCurrentPageIndex,
    edited,
    markEdited,
    saveFailed,
    pauseSyncing,
    resumeSyncing,
  } = useFormDraftState({
    formId: id,
    actionId,
    formSnapshotId,
    persistKey,
    syncDraftToServer,
    readOnly,
    completedFormResponse,
    draftFormResponse,
    initialPageIndex,
    userDefaultPublic,
    fieldLookup,
    defaultValueMap,
    outputFieldDefaultPublic,
    outputFieldIds,
    maxPageIndex,
  });

  const { formTopRef, fieldRef, focusInvalidField } = useFormScroll({
    scrollContainerRef,
    currentPageIndex,
  });
  const { fieldErrors, clearFieldErrors, applyFieldErrorUpdates } =
    useFieldErrors();
  const { deviceType, effectiveDeviceType } = useDeviceType({
    readOnly,
    completedFormResponse,
  });

  const {
    userLocation,
    visibilityContext,
    visibilityValidators,
    previousAnswers,
    sourceHistories,
    variableAggregates,
  } = useFormInputs({
    schema,
    formId: id,
    formSnapshotId,
    readOnly,
    user,
    userLoading,
    adminPreviewUserId,
    completedFormResponse,
    loadUserLocation: !!loadCurrentUserLocation && hasUserLocationDisplayBlock,
  });
  const { previousAnswerSchemas, previousAnswerData } = previousAnswers;

  useEffect(() => {
    if (readOnly) return;
    if (Object.keys(previousAnswerData).length === 0) return;
    setFormData((formData) =>
      prefillListsFromPreviousAnswers({ schema, previousAnswerData, formData }),
    );
  }, [previousAnswerData, schema, readOnly]);

  const {
    visibilityExtras,
    effectiveFormData,
    variableValues,
    variablesError,
    resolvedOptions,
    isElementCurrentlyVisible,
    fieldContext,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validateFieldValue,
  } = useFormVisibility({
    schema,
    formData,
    setFormData,
    readOnly,
    currentPageIndex,
    setCurrentPageIndex,
    effectiveDeviceType,
    visibilityValidatorResults: visibilityValidators.results,
    fieldLookup,
    previousAnswerData,
    sourceHistories,
    variableAggregates,
    randomizationKey,
    userHasCity: visibilityContext.userHasCity,
    userPropertyHasValue: visibilityContext.userPropertyHasValue,
    firstContractSignedAt: visibilityContext.firstContractSignedAt,
    completedActionCount: visibilityContext.completedActionCount,
    visibilityInputs: {
      visibilityContextLoading: visibilityContext.isLoading,
      visibilityContextFailed: visibilityContext.failed,
      visibilityValidatorsFailed: visibilityValidators.failed,
      userLoading,
      previousAnswersPending: previousAnswers.previousAnswersPending,
    },
  });

  const { validateScreen, validatePage, validateAllPages } = useFormValidation({
    schema,
    readOnly,
    effectiveFormData,
    visibilityExtras,
    visiblePageIndices,
    isElementCurrentlyVisible,
    validateFieldValue,
    applyFieldErrorUpdates,
  });

  const { updateField, imageUpload } = useFormEditing({
    readOnly,
    edited,
    markEdited,
    onFormStarted,
    setFormData,
    fieldLookup,
    validateFieldValue,
    applyFieldErrorUpdates,
  });
  const { uploadingAny } = imageUpload;

  const formTrackingParams = {
    formId: id,
    actionId,
    currentPageIndex,
    pageCount: schema.pages.length,
    enabled: !!onSubmit && !readOnly,
  };

  useFormPageDurationTracking(formTrackingParams);
  const trackValidationError =
    useFormValidationErrorTracking(formTrackingParams);

  const submission = useFormSubmission({
    readOnly,
    onSubmit,
    onAbandonAction,
    formSnapshotId,
    actionId,
    schema,
    sourceHistories,
    visibilityValidatorResults: visibilityValidators.results,
    deviceType,
    fieldLookup,
    formData,
    effectiveFormData,
    publicAnswers,
    phDistinctId,
    sessionReplayUrl,
    uploadingImages: uploadingAny,
    visibilitySettled,
    currentPageIndex,
    setCurrentPageIndex,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    validateScreen,
    validatePage,
    validateAllPages,
    focusInvalidField,
    trackValidationError,
    pauseSyncing,
    resumeSyncing,
  });

  useEffect(() => {
    clearFieldErrors();
  }, [schema]);

  return {
    schema,
    readOnly,
    user,
    activeUserKey,
    randomizationKey,
    userDefaultPublic,
    outputFieldDefaultPublic,
    unknownKind,
    variablesError,
    gate: variableInputsGate(sourceHistories, variableAggregates),
    visibilityContextLoading: visibilityContext.isLoading,
    previousAnswerData,
    previousAnswerSchemas,
    userLocation,
    publicAnswers,
    setPublicAnswer,
    currentPageIndex,
    setCurrentPageIndex,
    saveFailed,
    formTopRef,
    fieldRef,
    fieldErrors,
    effectiveFormData,
    variableValues,
    resolvedOptions,
    isElementCurrentlyVisible,
    fieldContext,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validateFieldValue,
    updateField,
    imageUpload,
    ...submission,
  };
}

export type WebFormState = ReturnType<typeof useWebFormState>;
