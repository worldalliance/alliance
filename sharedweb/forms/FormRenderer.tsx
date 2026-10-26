/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import { interpolateFieldText } from "@alliance/common/forms/variable-interpolation";
import {
  FormResponseDto,
  SubmitFormDto,
  type UserDto,
} from "@alliance/shared/client";
import { computeActiveUserKey } from "@alliance/shared/formrenderer";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import { computeFormStorageKey } from "@alliance/shared/forms/formDrafts";
import { completedFormSchema } from "@alliance/shared/forms/formulaChoices";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { prefillListsFromPreviousAnswers } from "@alliance/shared/forms/listPrefill";
import {
  aggregateTarget,
  useVariableAggregates,
} from "@alliance/shared/forms/useVariableAggregates";
import {
  historySubject,
  useVariableSourceHistories,
} from "@alliance/shared/forms/useVariableSourceHistories";
import { variableInputsGate } from "@alliance/shared/forms/variableInputsGate";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import {
  deviceTimeZone,
  formTimeZoneDefault,
} from "@alliance/shared/lib/timeZone";
import { useImageUpload } from "@alliance/shared/lib/useImageUpload";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import { cn } from "@alliance/shared/styles/util";
import {
  useCurrentUserLocation,
  useFieldErrors,
  useFormSchemaMaps,
  useFormValidation,
  useFormVisibility,
  usePreviousAnswerSources,
  useRandomizationKey,
  useVisibilityValidatorResults,
} from "@alliance/shared/useFormRenderer";
import React, { useEffect, useMemo, useState } from "react";
import Spinner from "../ui/Spinner";
import {
  useFormPageDurationTracking,
  useFormValidationErrorTracking,
} from "./formAnalytics";
import FormNavigation from "./FormNavigation";
import FormPage from "./FormPage";
import OutputPublicToggle from "./OutputPublicToggle";
import RenderField from "./RenderField";
import { useDeviceType } from "./useDeviceType";
import { useFormDraftState } from "./useFormDraftState";
import { useFormScroll } from "./useFormScroll";
import { useFormSubmission } from "./useFormSubmission";
import { variableInputsGateView } from "./variableInputsGateView";
import WithdrawalMenu from "./WithdrawalMenu";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  formSnapshotId: number | null;
  publicAction?: boolean;
  createAccountHref?: string;
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
  disableOptionRandomization?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  followUp?: boolean;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Prefill form with these answers when there is no locally-persisted draft. Used to restore a guest's answers after signup. */
  draftFormResponse?: FormResponseDto | null;
  /** Save progress to the member's account as well as this device, so the form can be finished elsewhere. */
  syncDraftToServer?: boolean;
  fieldLabelRightContent?: Record<string, React.ReactNode>;
  /** When set, previousAnswer blocks fetch this user's responses via the admin all-responses endpoint. */
  adminPreviewUserId?: string | number;
  /** For admins: name the variable that blocks the form in place of the refresh advice. */
  showVariableError?: boolean;
  /** When true, fetch the logged-in viewer's saved city for userLocation display blocks. */
  loadCurrentUserLocation?: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null; // null for admin preview
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

export { computeFormStorageKey };

const FormRenderer = ({
  form,
  id,
  formSnapshotId,
  publicAction,
  createAccountHref,
  onSubmit,
  persistKey,
  userId,
  user,
  userLoading = false,
  disableOptionRandomization,
  onFormStarted,
  phDistinctId,
  onAbandonAction,
  renderFormAsCompleted,
  followUp,
  completedFormResponse,
  draftFormResponse,
  syncDraftToServer,
  fieldLabelRightContent,
  adminPreviewUserId,
  showVariableError,
  loadCurrentUserLocation,
  actionId,
  initialPageIndex,
  sessionReplayUrl,
  scrollContainerRef,
}: FormRendererProps) => {
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

  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const {
    formData,
    setFormData,
    publicAnswers,
    setPublicAnswer,
    currentPageIndex,
    setCurrentPageIndex,
    lockDraft,
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
    edited: hasEmittedStart,
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
    results: visibilityValidatorResults,
    failed: visibilityValidatorsFailed,
  } = useVisibilityValidatorResults({
    schema,
    readOnly,
    savedResults: completedFormResponse?.visibilityValidatorResults,
    signedIn: !!user || adminPreviewUserId !== undefined,
  });

  const { previousAnswerSchemas, previousAnswerData, previousAnswersPending } =
    usePreviousAnswerSources({
      schema,
      previewUserId: adminPreviewUserId,
      signedIn: !!user,
    });

  const sourceHistories = useVariableSourceHistories({
    schema,
    subject: historySubject({
      adminPreviewUserId,
      signedIn: !!user,
      userLoading,
    }),
  });

  const variableAggregates = useVariableAggregates({
    schema,
    target: aggregateTarget({
      admin: adminPreviewUserId !== undefined,
      formId: id,
      formSnapshotId,
    }),
  });

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

  const { validatePage, validateAllPages } = useFormValidation({
    schema,
    readOnly,
    effectiveFormData,
    visibilityExtras,
    visiblePageIndices,
    isElementCurrentlyVisible,
    validateFieldValue,
    applyFieldErrorUpdates,
  });

  const ensureStarted = () => {
    if (readOnly) return;
    lockDraft();
    if (!hasEmittedStart) {
      try {
        onFormStarted?.();
      } finally {
        setHasEmittedStart(true);
      }
    }
  };

  const currentPage =
    currentPageIndex < schema.pages.length &&
    visiblePageIndices.includes(currentPageIndex)
      ? schema.pages[currentPageIndex]
      : null;
  const isLastPage = nextVisiblePageIndex === null;
  const isFirstPage = previousVisiblePageIndex === null;

  const updateField: SetFieldValue = (fieldId, value) => {
    if (readOnly) return;
    ensureStarted();
    setFormData((prev) => {
      const next = {
        ...prev,
        [fieldId]: resolveFormValue(value, prev[fieldId]),
      };
      const fieldDefinition = fieldLookup.get(fieldId);
      if (fieldDefinition) {
        const nextValue = next[fieldId];
        if (fieldDefinition.kind === "multiselect") {
          const selections = Array.isArray(nextValue) ? nextValue : [];
          const validationResult =
            selections.length === 0
              ? null
              : validateFieldValue(fieldDefinition, nextValue, next);
          applyFieldErrorUpdates({ [fieldId]: validationResult });
        } else if (fieldDefinition.kind === "ranking") {
          // Don't flag partial rankings while the user is still placing
          // items; page validation on submit enforces completeness.
          applyFieldErrorUpdates({ [fieldId]: null });
        } else {
          const requiredError = validateFieldValue(
            fieldDefinition,
            nextValue,
            next,
          );
          if (fieldDefinition.kind === "list") {
            applyFieldErrorUpdates({ [fieldId]: requiredError }, fieldId);
          } else {
            applyFieldErrorUpdates({ [fieldId]: requiredError });
          }
        }
      } else {
        applyFieldErrorUpdates({ [fieldId]: null });
      }
      return next;
    });
  };

  const imageUpload = useImageUpload({
    onUploaded: (slot, imageKey) =>
      applyUploadedImage({ slot, imageKey, setFieldValue: updateField }),
    onStart: ensureStarted,
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

  const {
    formRef,
    submitting,
    handleNext,
    handlePrevious,
    validateAllPagesAndShowFirstInvalid,
    submitCurrentPage,
    handleSubmit,
    handleAbandon,
  } = useFormSubmission({
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
    uploadingImages: uploadingAny,
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
  });

  useEffect(() => {
    clearFieldErrors();
  }, [schema]);

  const renderField = (field: AnyField) => {
    const isOutputField = Boolean(field.output?.output);
    const defaultSharePublic =
      outputFieldDefaultPublic.get(field.id) ?? userDefaultPublic;
    const sharePublicly = publicAnswers[field.id] ?? defaultSharePublic;
    return (
      <>
        <RenderField
          field={withResolvedOptions(
            interpolateFieldText(field, variableValues),
            resolvedOptions,
          )}
          value={effectiveFormData[field.id]}
          onChange={readOnly ? undefined : (val) => updateField(field.id, val)}
          fileUpload={readOnly ? undefined : imageUpload}
          disabled={readOnly}
          error={fieldErrors[field.id]}
          randomizationKey={
            disableOptionRandomization ? undefined : randomizationKey
          }
          disableOptionRandomization={disableOptionRandomization}
          user={user}
          labelRightAddon={fieldLabelRightContent?.[field.id]}
          fieldContext={fieldContext}
          fieldErrors={fieldErrors}
          responseHiddenFromOthers={isOutputField && !sharePublicly}
        />
        <OutputPublicToggle
          field={field}
          sharePublicly={sharePublicly}
          disabled={readOnly}
          onChange={(nextPublic) => setPublicAnswer(field.id, nextPublic)}
        />
      </>
    );
  };

  const gate = variableInputsGateView({
    gate: variableInputsGate(sourceHistories, variableAggregates),
    readOnly,
  });
  if (gate !== null) return gate;

  if (unknownKind || variablesError !== null) {
    return (
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        role="alert"
      >
        <p className="font-medium">This form can&apos;t be displayed</p>
        <p className="mt-1 text-sm">
          {showVariableError && variablesError !== null
            ? variablesError
            : "Refreshing the page may fix the issue."}
        </p>
      </div>
    );
  }

  if (visibilityContextLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div ref={formTopRef} className="mx-auto scroll-mt-24">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6"
      >
        {/* Page Content */}
        <div
          className={cn(
            "space-y-6",
            readOnly && schema.pages.length === 1 && "mb-0",
          )}
        >
          {currentPage !== null && (
            <FormPage
              elements={currentPage.fields}
              activeUserKey={activeUserKey}
              isElementCurrentlyVisible={isElementCurrentlyVisible}
              variableValues={variableValues}
              blockProps={{
                previousAnswerData,
                previousAnswerSchemas,
                userLocation: userLocationDisplayValue,
                userLocationLoading: currentUserLocationLoading,
              }}
              fieldRef={fieldRef}
              renderField={renderField}
            />
          )}
        </div>
        <FormNavigation
          pageNumber={Math.max(
            1,
            visiblePageIndices.indexOf(currentPageIndex) + 1,
          )}
          pageCount={visiblePageIndices.length}
          onPrevious={isFirstPage ? null : handlePrevious}
          onNext={isLastPage ? null : handleNext}
          nextDisabled={uploadingAny || !visibilitySettled}
          readOnly={readOnly}
          createAccountHref={createAccountHref}
          onSubmit={onSubmit ? submitCurrentPage : null}
          onPreviewSubmit={validateAllPagesAndShowFirstInvalid}
          submitting={submitting}
          submitLabel={
            schema.submit?.label || (followUp ? "Submit" : "Complete")
          }
          uploadingImages={uploadingAny}
          onCancelUploads={imageUpload.cancelAll}
          saveFailed={saveFailed}
        >
          {onAbandonAction && !readOnly && !publicAction && !followUp && (
            <WithdrawalMenu disabled={submitting} onWithdraw={handleAbandon} />
          )}
        </FormNavigation>
      </form>
    </div>
  );
};

export default FormRenderer;
