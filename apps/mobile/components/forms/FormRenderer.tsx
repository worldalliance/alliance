/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { type DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { withResolvedOptions } from "@alliance/common/forms/formula-options";
import {
  interpolateDisplayBlock,
  interpolateFieldText,
} from "@alliance/common/forms/variable-interpolation";
import {
  FormResponseDto,
  SubmitFormDto,
  type UserDto,
} from "@alliance/shared/client";
import {
  computeActiveUserKey,
  resolveDisplayBlockForUser,
} from "@alliance/shared/formrenderer";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import { filterAnswersByFieldIds } from "@alliance/shared/forms/formDrafts";
import {
  completedFormSchema,
  formulaSourcesFor,
} from "@alliance/shared/forms/formulaChoices";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { stripCardIds } from "@alliance/shared/forms/listCards";
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
  cancelAllImageUploads,
  draftSaveFailed,
  outputFieldPublicToggle,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
import { formTimeZoneDefault } from "@alliance/shared/lib/timeZone";
import { useImageUpload } from "@alliance/shared/lib/useImageUpload";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
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
import { DeviceType, deviceType as expoDeviceType } from "expo-device";
import { CircleCheck, Ellipsis, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { getDeviceTimeZone } from "../../lib/timeZone";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Checkbox from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";
import { RenderDisplayBlockMobile } from "./RenderDisplayBlock";
import { RenderField } from "./RenderField";
import { useFormDraftState } from "./useFormDraftState";
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

const detectDeviceType = (): DeviceVisibilityTarget => {
  if (expoDeviceType === null) return "mobile";
  switch (expoDeviceType) {
    case DeviceType.PHONE:
      return "mobile";
    case DeviceType.TABLET:
      return "tablet";
    case DeviceType.DESKTOP:
      return "desktop";
    case DeviceType.UNKNOWN:
    case DeviceType.TV:
      return "mobile";
    default:
      throw new Error(`unknown device type: ${expoDeviceType satisfies never}`);
  }
};

const DEVICE_TYPE: DeviceVisibilityTarget = detectDeviceType();

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
  const [submitting, setSubmitting] = useState(false);
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

  const renderPublicToggle = (field: AnyField) => {
    if (!field.output?.output) return null;
    const useMakePublicToggle = !!field.output.privateByDefault;
    const defaultSharePublic =
      outputFieldDefaultPublic.get(field.id) ?? userDefaultPublic;
    const sharePublicly = publicAnswers[field.id] ?? defaultSharePublic;
    const toggleChecked = useMakePublicToggle ? sharePublicly : !sharePublicly;
    const toggleLabel = useMakePublicToggle
      ? outputFieldPublicToggle.showPublicly
      : outputFieldPublicToggle.hidePublicly;
    return (
      <View className="mt-2">
        <Checkbox
          checked={toggleChecked}
          disabled={readOnly}
          onChange={(next) => {
            const nextPublic = useMakePublicToggle ? next : !next;
            handlePublicToggleChange(field.id, nextPublic);
          }}
          label={toggleLabel}
        />
      </View>
    );
  };

  const handleNextPage = async () => {
    if (nextVisiblePageIndex === null || !visibilitySettled) {
      return;
    }
    const result = await validatePage(currentPageIndex, true);
    if (result.isValid) {
      setCurrentPageIndex(nextVisiblePageIndex);
      setImmediate(() => scrollPageTo(0, false));
    }
  };

  const handlePreviousPage = () => {
    if (previousVisiblePageIndex === null) {
      return;
    }
    setCurrentPageIndex(previousVisiblePageIndex);
    setImmediate(() => scrollToEnd(false));
  };

  const handleSubmit = async () => {
    if (submitting || readOnly || imageUpload.uploadingAny) {
      return;
    }
    if (onSubmit && formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }
    setSubmitting(true);

    if (nextVisiblePageIndex !== null) {
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) {
        setCurrentPageIndex(nextVisiblePageIndex);
        setImmediate(() => scrollPageTo(0, false));
      }
      setSubmitting(false);
      return;
    }

    const { isValid, firstInvalidPageIndex } = await validateAllPages();
    if (!isValid) {
      if (
        typeof firstInvalidPageIndex === "number" &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        setCurrentPageIndex(firstInvalidPageIndex);
        setImmediate(() => scrollPageTo(0, false));
      }
      setSubmitting(false);
      return;
    }

    if (!onSubmit || formSnapshotId === null) {
      setSubmitting(false);
      return;
    }

    const sanitizedAnswers = stripCardIds(
      filterAnswersByFieldIds(effectiveFormData, fieldLookup),
    );
    const submissionPayload: SubmitFormDto = {
      answers: sanitizedAnswers,
      formSnapshotId,
      actionId,
      formulaSources: formulaSourcesFor(schema, sourceHistories),
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
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
    const submissionPayload: SubmitFormDto = {
      answers: stripCardIds(formData),
      formSnapshotId,
      actionId,
      formulaSources: formulaSourcesFor(schema, sourceHistories),
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
    };

    pauseSyncing();
    onAbandonAction?.({ ...choice, partialFormData: submissionPayload });
    setWithdrawOpen(false);
  };

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

  const pageFields = currentPage ? currentPage.fields : undefined;
  const resolvedPageElements = useMemo(
    () =>
      (pageFields ?? []).map((element) =>
        isQuestionField(element)
          ? element
          : resolveDisplayBlockForUser(element, activeUserKey),
      ),
    [pageFields, activeUserKey],
  );
  const pageElementVisible = useMemo(
    () =>
      resolvedPageElements.map((element) => isElementCurrentlyVisible(element)),
    [resolvedPageElements, isElementCurrentlyVisible],
  );
  const hasRenderedNeighborAbove = (idx: number): boolean => {
    for (let j = idx - 1; j >= 0; j--) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };
  const hasRenderedNeighborBelow = (idx: number): boolean => {
    for (let j = idx + 1; j < pageElementVisible.length; j++) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };

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
      <View className="gap-y-4">
        {pageFields?.map((element, idx) => {
          if (!pageElementVisible[idx]) {
            return null;
          }
          if (!isQuestionField(element)) {
            const resolvedBlock = resolvedPageElements[idx] as DisplayBlock;
            return (
              <View key={resolvedBlock.id ?? `block-${idx}`}>
                <RenderDisplayBlockMobile
                  block={interpolateDisplayBlock(resolvedBlock, variableValues)}
                  previousAnswerData={previousAnswerData}
                  previousAnswerSchemas={previousAnswerSchemas}
                  hasRenderedNeighborAbove={hasRenderedNeighborAbove(idx)}
                  hasRenderedNeighborBelow={hasRenderedNeighborBelow(idx)}
                  user={user}
                  userLocation={userLocationDisplayValue}
                  userLocationLoading={currentUserLocationLoading}
                />
              </View>
            );
          }
          const field = element as AnyField;
          return (
            <View key={field.id}>
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
              {renderPublicToggle(field)}
            </View>
          );
        })}
      </View>

      {readOnly && visiblePageCount > 1 && (
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm text-zinc-500">
              Page {currentVisiblePageNumber} of {visiblePageCount}
            </Text>
          </View>
          <View className="flex-row gap-3">
            {!isFirstPage && (
              <Button
                onPress={handlePreviousPage}
                color={ButtonColor.Outline}
                size={ButtonSize.Medium}
                className="flex-1"
                title="Back"
              />
            )}
            {!isLastPage && (
              <Button
                onPress={() => {
                  if (nextVisiblePageIndex !== null) {
                    setCurrentPageIndex(nextVisiblePageIndex);
                  }
                  setImmediate(() => scrollPageTo(0, false));
                }}
                color={ButtonColor.Black}
                size={ButtonSize.Medium}
                className="flex-1"
                title="Next"
              />
            )}
          </View>
        </View>
      )}
      {!readOnly && (
        <View>
          <View className="">
            <View className="flex-row justify-between items-center mb-3">
              {visiblePageCount > 1 ? (
                <Text className="text-sm text-zinc-500">
                  Page {currentVisiblePageNumber} of {visiblePageCount}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-1.5">
              {!isFirstPage && (
                <Button
                  onPress={handlePreviousPage}
                  color={ButtonColor.Outline}
                  size={ButtonSize.Medium}
                  className="flex-1"
                  disabled={submitting}
                  title="Back"
                />
              )}
              <Button
                onPress={isLastPage ? handleSubmit : handleNextPage}
                color={ButtonColor.Black}
                size={ButtonSize.Medium}
                className="flex-2 py-4! gap-x-1"
                disabled={
                  submitting ||
                  imageUpload.uploadingAny ||
                  (!isLastPage && !visibilitySettled)
                }
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {isLastPage ? (
                      <CircleCheck size={16} color="#fff" strokeWidth={2.5} />
                    ) : null}
                    <Text
                      className="text-white text-base"
                      weight={FontWeight.Medium}
                    >
                      {isLastPage
                        ? onSubmit
                          ? "Complete"
                          : "Complete (Preview Mode)"
                        : "Next"}
                    </Text>
                  </>
                )}
              </Button>
              {onAbandonAction && (
                <Button
                  onPress={() => setWithdrawOpen(true)}
                  color={ButtonColor.Outline}
                  size={ButtonSize.Medium}
                >
                  <Ellipsis size={15} />
                </Button>
              )}
            </View>
          </View>
          {imageUpload.uploadingAny && (
            <View className="flex-row items-center gap-1 p-2">
              <Text className="text-zinc-500 text-base">
                {waitingForImageUpload}
              </Text>
              <TouchableOpacity
                onPress={imageUpload.cancelAll}
                accessibilityLabel={cancelAllImageUploads}
                hitSlop={8}
                className="p-1"
              >
                <X size={20} color={colors.text.icon} />
              </TouchableOpacity>
            </View>
          )}
          {saveFailed && !readOnly && (
            <Text className="text-amber-600 text-base p-2">
              {draftSaveFailed}
            </Text>
          )}
          {Object.keys(fieldErrors).length > 0 && (
            <Text className="text-red-500 text-base p-2">
              Your form has errors. Please fix before submitting.
            </Text>
          )}
        </View>
      )}

      {onAbandonAction && (
        <WithdrawalModal
          visible={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          disabled={submitting}
          onWithdraw={handleAbandon}
        />
      )}
    </View>
  );
};

export default FormRenderer;
