import { type FormSchema } from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import { interpolateFieldText } from "@alliance/common/forms/variable-interpolation";
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
  useCurrentUserLocation,
  useFieldErrors,
  useFormSchemaMaps,
  useFormValidation,
  useFormVisibility,
  useRandomizationKey,
} from "@alliance/shared/useFormRenderer";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { getDeviceTimeZone } from "../../lib/timeZone";
import Text, { FontWeight } from "../system/Text";
import { DEVICE_TYPE } from "./deviceType";
import { FormNavigation, ReadOnlyPageNavigation } from "./FormNavigation";
import FormPage from "./FormPage";
import OutputPublicToggle from "./OutputPublicToggle";
import { pageNavigation } from "./pageNavigation";
import { RenderField } from "./RenderField";
import { useFormDraftState } from "./useFormDraftState";
import { useFormSubmission } from "./useFormSubmission";
import { variableInputsGateView } from "./variableInputsGateView";
import WithdrawalModal from "./WithdrawalModal";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  formSnapshotId: number | null;
  publicAction?: boolean;
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
  disableOptionRandomization?: boolean;
  loadCurrentUserLocation?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Save progress to the member's account as well as this device, so the form can be finished elsewhere. */
  syncDraftToServer?: boolean;
  /** `null` without `renderFormAsCompleted` is a preview: editable, never submitted. */
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
};

const FormRenderer = ({
  form,
  id,
  formSnapshotId,
  onSubmit,
  persistKey,
  reloadSourceHistories,
  userId,
  user,
  userLoading = false,
  disableOptionRandomization,
  loadCurrentUserLocation,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
  syncDraftToServer,
  actionId,
  initialPageIndex,
  phDistinctId,
  sessionReplayUrl,
  scrollPageTo,
  scrollToEnd,
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);
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

  const navigation = pageNavigation({
    currentPageIndex,
    setCurrentPageIndex,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validatePage,
    validateAllPages,
    scrollPageTo,
    scrollToEnd,
  });

  const { submitting, handleSubmit, handleAbandon } = useFormSubmission({
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
    readyToSubmit: navigation.readyToSubmit,
    pauseSyncing,
    resumeSyncing,
    clearStoredDraft,
  });

  const currentPage = visiblePageIndices.includes(currentPageIndex)
    ? schema.pages[currentPageIndex]
    : undefined;
  const isFirstPage = previousVisiblePageIndex === null;
  const isLastPage = nextVisiblePageIndex === null;
  const visiblePageCount = visiblePageIndices.length;
  const currentVisiblePageNumber = Math.max(
    1,
    visiblePageIndices.indexOf(currentPageIndex) + 1,
  );

  const gate = variableInputsGateView({
    gate: variableInputsGate(sourceHistories, variableAggregates),
    readOnly,
  });
  if (gate !== null) return gate;

  if (unknownKind || variablesError !== null) {
    return (
      <View className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <Text weight={FontWeight.Medium} className="text-amber-800">
          This form can&apos;t be displayed
        </Text>
        <Text className="text-sm text-amber-800 mt-1">
          Restarting the app or downloading the latest version may fix the
          issue.
        </Text>
      </View>
    );
  }

  if (visibilityContextLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View className="flex flex-col gap-y-8">
      <FormPage
        elements={currentPage?.fields ?? []}
        activeUserKey={activeUserKey}
        isElementCurrentlyVisible={isElementCurrentlyVisible}
        variableValues={variableValues}
        blockProps={{
          previousAnswerData,
          previousAnswerSchemas,
          user,
          userLocation: userLocationDisplayValue,
          userLocationLoading: currentUserLocationLoading,
        }}
        renderField={(field) => (
          <>
            <RenderField
              field={withResolvedOptions(
                interpolateFieldText(field, variableValues),
                resolvedOptions,
              )}
              value={effectiveFormData[field.id]}
              onChange={(value) => handleFieldChange(field.id, value)}
              fileUpload={readOnly ? undefined : imageUpload}
              disabled={readOnly}
              error={fieldErrors[field.id]}
              fieldErrors={fieldErrors}
              randomizationKey={randomizationKey}
              disableOptionRandomization={disableOptionRandomization}
              user={user}
              fieldContext={fieldContext}
            />
            <OutputPublicToggle
              field={field}
              sharePublicly={
                publicAnswers[field.id] ??
                outputFieldDefaultPublic.get(field.id) ??
                userDefaultPublic
              }
              disabled={readOnly}
              onChange={(sharePublicly) =>
                handlePublicToggleChange(field.id, sharePublicly)
              }
            />
          </>
        )}
      />

      {readOnly && visiblePageCount > 1 && (
        <ReadOnlyPageNavigation
          pageNumber={currentVisiblePageNumber}
          pageCount={visiblePageCount}
          onBack={isFirstPage ? null : navigation.goToPreviousPage}
          onNext={navigation.browseToNextPage}
        />
      )}
      {!readOnly && (
        <FormNavigation
          pageNumber={currentVisiblePageNumber}
          pageCount={visiblePageCount}
          onBack={isFirstPage ? null : navigation.goToPreviousPage}
          onPrimary={isLastPage ? handleSubmit : navigation.goToNextPage}
          isLastPage={isLastPage}
          preview={!onSubmit}
          submitting={submitting}
          primaryDisabled={
            submitting ||
            imageUpload.uploadingAny ||
            (!isLastPage && !visibilitySettled)
          }
          onWithdraw={onAbandonAction ? () => setWithdrawOpen(true) : null}
          uploadingImages={imageUpload.uploadingAny}
          onCancelUploads={imageUpload.cancelAll}
          saveFailed={saveFailed}
          hasFieldErrors={Object.keys(fieldErrors).length > 0}
        />
      )}

      {onAbandonAction && (
        <WithdrawalModal
          visible={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          disabled={submitting}
          onWithdraw={(choice) => {
            handleAbandon(choice);
            setWithdrawOpen(false);
          }}
        />
      )}
    </View>
  );
};

export default FormRenderer;
