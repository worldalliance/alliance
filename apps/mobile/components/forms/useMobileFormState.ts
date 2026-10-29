import {
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import {
  FormResponseDto,
  SubmitFormDto,
  type UserDto,
} from "@alliance/shared/client";
import { computeActiveUserKey } from "@alliance/shared/formrenderer";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import { completedFormSchema } from "@alliance/shared/forms/formulaChoices";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { useCurrentUserLocation } from "@alliance/shared/forms/useCurrentUserLocation";
import { useFormSchemaMaps } from "@alliance/shared/forms/useFormSchemaMaps";
import {
  useFieldErrors,
  useFormValidation,
} from "@alliance/shared/forms/useFormValidation";
import { usePreviousAnswerSources } from "@alliance/shared/forms/usePreviousAnswerSources";
import {
  aggregateTarget,
  useVariableAggregates,
} from "@alliance/shared/forms/useVariableAggregates";
import {
  historySubject,
  useVariableSourceHistories,
} from "@alliance/shared/forms/useVariableSourceHistories";
import { useVisibilityValidatorResults } from "@alliance/shared/forms/useVisibilityValidatorResults";
import { variableInputsGate } from "@alliance/shared/forms/variableInputsGate";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { formTimeZoneDefault } from "@alliance/shared/lib/timeZone";
import { useImageUpload } from "@alliance/shared/lib/useImageUpload";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import {
  useFormVisibility,
  useRandomizationKey,
} from "@alliance/shared/useFormRenderer";
import { useMemo, useState } from "react";
import { getDeviceTimeZone } from "../../lib/timeZone";
import { DEVICE_TYPE } from "./deviceType";
import { useFormDraftState } from "./useFormDraftState";
import { useFormSubmission } from "./useFormSubmission";

export type MobileFormStateParams = {
  form: FormSchema;
  id: number;
  formSnapshotId: number | null;
  actionId: number;
  persistKey?: string | null;
  /** Changing it refetches the answers from other forms the form reads. */
  reloadSourceHistories?: number;
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
  loadCurrentUserLocation?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Save progress to the member's account as well as this device, so the form can be finished elsewhere. */
  syncDraftToServer?: boolean;
  /** `null` without `renderFormAsCompleted` is a preview: editable, never submitted. */
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null;
};

export function useMobileFormState({
  form,
  id,
  formSnapshotId,
  actionId,
  persistKey,
  reloadSourceHistories,
  initialPageIndex,
  userId,
  phDistinctId,
  sessionReplayUrl,
  user,
  userLoading = false,
  loadCurrentUserLocation,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
  syncDraftToServer,
  onSubmit,
}: MobileFormStateParams) {
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
  const timeZone = formTimeZoneDefault({
    saved: user?.timeZone,
    device: getDeviceTimeZone(),
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

  const { previousAnswerSchemas, previousAnswerData, previousAnswersPending } =
    usePreviousAnswerSources({ schema, signedIn: !!user });

  const sourceHistories = useVariableSourceHistories({
    schema,
    subject: historySubject({
      adminPreviewUserId: undefined,
      signedIn: !!user,
      userLoading,
    }),
    reload: reloadSourceHistories,
  });

  const variableAggregates = useVariableAggregates({
    schema,
    target: aggregateTarget({ admin: false, formId: id, formSnapshotId }),
  });

  const {
    results: visibilityValidatorResults,
    failed: visibilityValidatorsFailed,
  } = useVisibilityValidatorResults({
    schema,
    readOnly,
    savedResults: completedFormResponse?.visibilityValidatorResults,
    signedIn: !!user,
  });
  const { fieldErrors, applyFieldErrorUpdates } = useFieldErrors();
  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const { currentUserLocationLoading, userLocationDisplayValue } =
    useCurrentUserLocation({
      enabled: !!loadCurrentUserLocation && hasUserLocationDisplayBlock,
      user,
    });

  const {
    userHasCity,
    userPropertyHasValue,
    firstContractSignedAt,
    completedActionCount,
    isLoading: visibilityContextLoading,
    failed: visibilityContextFailed,
  } = useVisibilityContext(schema, {
    enabled: !!user,
  });

  const {
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
  } = useFormDraftState({
    formId: id,
    actionId,
    formSnapshotId,
    persistKey,
    syncDraftToServer,
    readOnly,
    completedFormResponse,
    initialPageIndex,
    edited: hasEmittedStart,
    fieldLookup,
    defaultValueMap,
    outputFieldDefaultPublic,
    outputFieldIds,
    maxPageIndex,
  });

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
    effectiveDeviceType: DEVICE_TYPE,
    visibilityValidatorResults,
    fieldLookup,
    previousAnswerData,
    sourceHistories,
    variableAggregates,
    randomizationKey,
    userHasCity,
    userPropertyHasValue,
    firstContractSignedAt,
    completedActionCount,
    visibilityInputs: {
      visibilityContextLoading,
      visibilityContextFailed,
      visibilityValidatorsFailed,
      userLoading,
      previousAnswersPending,
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

  const markFormStarted = () => {
    if (hasEmittedStart) return;
    setHasEmittedStart(true);
    onFormStarted?.();
  };

  const handleFieldChange: SetFieldValue = (fieldId, value) => {
    if (readOnly) return;
    setFormData((prev) => ({
      ...prev,
      [fieldId]: resolveFormValue(value, prev[fieldId]),
    }));
    applyFieldErrorUpdates(
      { [fieldId]: null },
      fieldLookup.get(fieldId)?.kind === "list" ? fieldId : undefined,
    );
    markFormStarted();
  };

  const imageUpload = useImageUpload({
    onUploaded: (slot, imageKey) =>
      applyUploadedImage({ slot, imageKey, setFieldValue: handleFieldChange }),
    onStart: markFormStarted,
  });

  const handlePublicToggleChange = (fieldId: string, nextPublic: boolean) => {
    if (readOnly) return;
    setPublicAnswers((prev) => ({ ...prev, [fieldId]: nextPublic }));
  };

  const submission = useFormSubmission({
    readOnly,
    uploadingImages: imageUpload.uploadingAny,
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
  });

  const validateScreenFields = async (fields: AnyField[]) =>
    (await validateScreen(fields)).isValid;

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
    visibilityContextLoading,
    previousAnswerData,
    previousAnswerSchemas,
    userLocationDisplayValue,
    currentUserLocationLoading,
    publicAnswers,
    currentPageIndex,
    setCurrentPageIndex,
    saveFailed,
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
    validatePage,
    validateScreenFields,
    handleFieldChange,
    handlePublicToggleChange,
    imageUpload,
    ...submission,
  };
}

export type MobileFormState = ReturnType<typeof useMobileFormState>;
