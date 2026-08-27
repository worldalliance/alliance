import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { type DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
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
  applyDefaultValues,
  computeActiveUserKey,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  resolveDisplayBlockForUser,
  restorableAnswers,
} from "@alliance/shared/formrenderer";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { stripCardIds } from "@alliance/shared/forms/listCards";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import {
  guestReferral,
  outputFieldPublicToggle,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
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
import {
  CircleDashed,
  Clock,
  Ellipsis,
  Scale,
  TreePalm,
  type LucideIcon,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useOutsideClick } from "../../sharedweb/lib/useOutsideClick";
import BaseButton, {
  BaseButtonSize,
  BaseButtonVariant,
} from "../ui/BaseButton";
import ConfettiWrapper from "../ui/ConfettiWrapper";
import Dropdown from "../ui/Dropdown";
import Spinner from "../ui/Spinner";
import {
  useFormPageDurationTracking,
  useFormValidationErrorTracking,
} from "./formAnalytics";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";

const WITHDRAWAL_OPTION_ICONS: Record<WithdrawalOption, LucideIcon> = {
  out_of_time: Clock,
  moral: Scale,
  other: CircleDashed,
};

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
  disableOptionRandomization?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  followUp?: boolean;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Prefill form with these answers when there is no locally-persisted draft. Used to restore a guest's answers after signup. */
  draftFormResponse?: FormResponseDto | null;
  fieldLabelRightContent?: Record<string, React.ReactNode>;
  /** When set, previousAnswer blocks fetch this user's responses via the admin all-responses endpoint. */
  adminPreviewUserId?: string | number;
  /** When true, fetch the logged-in viewer's saved city for userLocation display blocks. */
  loadCurrentUserLocation?: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<boolean>) | null; // null for admin preview
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

export { computeFormStorageKey };

const DEFAULT_DEVICE_TYPE: DeviceVisibilityTarget = "desktop";

const detectDeviceType = (): DeviceVisibilityTarget => {
  if (typeof window === "undefined") {
    return DEFAULT_DEVICE_TYPE;
  }
  const width = window.innerWidth;
  if (width < 640) {
    return "mobile";
  }
  if (width < 1024) {
    return "tablet";
  }
  return "desktop";
};

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
  disableOptionRandomization,
  onFormStarted,
  phDistinctId,
  onAbandonAction,
  renderFormAsCompleted,
  followUp,
  completedFormResponse,
  draftFormResponse,
  fieldLabelRightContent,
  adminPreviewUserId,
  loadCurrentUserLocation,
  actionId,
  initialPageIndex,
  sessionReplayUrl,
  scrollContainerRef,
}: FormRendererProps) => {
  // Compute schema and a namespaced storage key for persistence (if enabled)
  const schema = form as unknown as FormSchema;
  const readOnly = !!renderFormAsCompleted;
  const baseStorageKey = computeFormStorageKey({
    formId: id,
  });
  const storageKey = computeFormStorageKey({
    formId: id,
    instanceId: persistKey ?? undefined,
  });
  const activeUserKey = useMemo(
    () => computeActiveUserKey(user?.id, userId),
    [user?.id, userId],
  );
  const randomizationKey = useRandomizationKey({
    formId: id,
    activeUserKey,
    persistKey,
  });

  const [searchParams] = useSearchParams();

  const userDefaultPublic = user?.formDataPreference === "public";
  const {
    fieldLookup,
    defaultValueMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    pageCount,
    maxPageIndex,
  } = useFormSchemaMaps({ schema, userDefaultPublic });

  const clampPageIndex = (idx: number): number => {
    if (!Number.isFinite(idx)) return 0;
    const normalized = Math.floor(idx);
    if (normalized < 0) return 0;
    if (normalized > maxPageIndex) return maxPageIndex;
    return normalized;
  };

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() => {
    if (initialPageIndex !== undefined && !persistKey) {
      return clampPageIndex(initialPageIndex);
    }
    if (readOnly) return 0;
    if (typeof window === "undefined" || !persistKey) return 0;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const idx =
        typeof parsed?.currentPageIndex === "number"
          ? parsed.currentPageIndex
          : 0;
      return clampPageIndex(idx);
    } catch {
      return 0;
    }
  });
  const formTopRef = useRef<HTMLDivElement>(null);
  // Precedence: localStorage (active local edits) > draft (guest prefill, may
  // arrive after mount) > empty. Once either localStorage or a draft is applied,
  // we lock out later draft applies so we never stomp user edits.
  const draftLockedRef = useRef(false);
  // Guard against double-submit when the submit button's click handler
  // (ConfettiWrapper) and the form's submit event both call submitCurrentPage.
  const submittingRef = useRef(false);
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      const answers =
        (completedFormResponse?.answers as Record<string, FormValue>) || {};
      return filterAnswersByFieldIds(answers, fieldLookup);
    }

    const readLocalStorageAnswers = (): Record<string, FormValue> | null => {
      if (typeof window === "undefined" || !persistKey) return null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const storedFormData =
          parsed?.formData && typeof parsed.formData === "object"
            ? (parsed.formData as Record<string, FormValue>)
            : null;
        if (!storedFormData) return null;
        const filtered = restorableAnswers(storedFormData, fieldLookup);
        return Object.keys(filtered).length > 0 ? filtered : null;
      } catch {
        return null;
      }
    };

    const localAnswers = readLocalStorageAnswers();
    if (localAnswers) {
      draftLockedRef.current = true;
      return applyDefaultValues(localAnswers, defaultValueMap);
    }

    const draftAnswers = draftFormResponse?.answers
      ? restorableAnswers(
          draftFormResponse.answers as Record<string, FormValue>,
          fieldLookup,
        )
      : null;
    if (draftAnswers && Object.keys(draftAnswers).length > 0) {
      draftLockedRef.current = true;
      return applyDefaultValues(draftAnswers, defaultValueMap);
    }

    return applyDefaultValues({}, defaultValueMap);
  });

  const [publicAnswerOverrides, setPublicAnswerOverrides] = useState<
    Partial<Record<string, boolean>>
  >({});
  const resolvedPublicAnswers = useMemo(() => {
    if (readOnly && completedFormResponse?.publicAnswers) {
      return completedFormResponse.publicAnswers as Record<string, boolean>;
    }
    const resolved: Record<string, boolean> = {};
    for (const [fieldId, defaultPublic] of outputFieldDefaultPublic.entries()) {
      resolved[fieldId] = publicAnswerOverrides[fieldId] ?? defaultPublic;
    }
    return resolved;
  }, [
    readOnly,
    completedFormResponse?.publicAnswers,
    outputFieldDefaultPublic,
    publicAnswerOverrides,
  ]);

  const { fieldErrors, clearFieldErrors, applyFieldErrorUpdates } =
    useFieldErrors();
  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const [deviceType, setDeviceType] = useState<DeviceVisibilityTarget>(() =>
    detectDeviceType(),
  );
  const [submitting, setSubmitting] = useState(false);

  // Dropdown state for "decline to participate" options
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");
  const ref = useOutsideClick(() => setDropdownOpen(false));
  const navigate = useNavigate();
  const { currentUserLocationLoading, userLocationDisplayValue } =
    useCurrentUserLocation({
      enabled: !!loadCurrentUserLocation && hasUserLocationDisplayBlock,
      user,
    });

  const {
    userHasCity,
    firstContractSignedAt,
    completedActionCount,
    isLoading: visibilityContextLoading,
  } = useVisibilityContext(schema, {
    enabled: !!user,
  });

  useEffect(() => {
    if (readOnly || typeof window === "undefined") {
      return;
    }
    const updateDeviceType = () => {
      setDeviceType(detectDeviceType());
    };
    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);
    return () => {
      window.removeEventListener("resize", updateDeviceType);
    };
  }, [readOnly]);

  const savedDeviceType = completedFormResponse?.deviceType as
    | DeviceVisibilityTarget
    | undefined;

  const effectiveDeviceType = readOnly
    ? (savedDeviceType ?? deviceType)
    : deviceType;

  const visibilityValidatorResults = useVisibilityValidatorResults({
    schema,
    readOnly,
    savedResults: completedFormResponse?.visibilityValidatorResults,
  });

  const { previousAnswerSchemas, previousAnswerData } =
    usePreviousAnswerSources({ schema, previewUserId: adminPreviewUserId });

  // --- Apply guest draft answers when they arrive after mount ---
  // The draft query is fired in parallel with the form render so we don't
  // block paint on it; apply it here if the user hasn't started editing and
  // localStorage didn't already win the initial-state race.
  useEffect(() => {
    if (readOnly) return;
    if (draftLockedRef.current) return;
    if (!draftFormResponse?.answers) return;
    const draftAnswers = restorableAnswers(
      draftFormResponse.answers as Record<string, FormValue>,
      fieldLookup,
    );
    if (Object.keys(draftAnswers).length === 0) return;
    draftLockedRef.current = true;
    setFormData(applyDefaultValues(draftAnswers, defaultValueMap));
  }, [draftFormResponse, readOnly, fieldLookup, defaultValueMap]);

  // --- Prefill list fields from previous answer data ---
  useEffect(() => {
    if (readOnly) return;
    if (Object.keys(previousAnswerData).length === 0) return;

    setFormData((prev) => {
      const next = { ...prev };
      let didUpdate = false;

      for (const page of schema.pages) {
        for (const element of page.fields) {
          if (!isQuestionField(element)) continue;
          if (element.kind !== "list") continue;
          const listField = element;
          const prefill = listField.prefillFromPreviousAnswer;
          if (!prefill) continue;

          // Only prefill if untouched (undefined, null, or array of all-empty objects from defaultNumber)
          const cur = next[listField.id];
          const isUntouched =
            cur === undefined ||
            cur === null ||
            (Array.isArray(cur) &&
              cur.every(
                (c: unknown) =>
                  typeof c === "object" &&
                  c !== null &&
                  Object.keys(c as Record<string, unknown>).length === 0,
              ));
          if (!isUntouched) continue;

          const sourceAnswers = previousAnswerData[prefill.sourceFormId];
          if (!sourceAnswers) continue;
          const sourceList = sourceAnswers[prefill.sourceFieldId];
          if (!Array.isArray(sourceList) || sourceList.length === 0) continue;

          // Respect max constraint
          const maxCards =
            typeof listField.max === "number" ? listField.max : Infinity;
          const items = sourceList.slice(0, maxCards);

          const prefilledCards = items.map(
            (srcCard: Record<string, unknown>) => {
              const card: Record<string, FormValue> = {};
              const val = srcCard[prefill.sourceSubFieldId];
              if (val !== undefined && val !== null) {
                card[prefill.targetSubFieldId] = val as FormValue;
              }
              return card;
            },
          );

          next[listField.id] = prefilledCards;
          didUpdate = true;
        }
      }
      return didUpdate ? next : prev;
    });
  }, [previousAnswerData, schema, readOnly]);

  const {
    visibilityExtras,
    effectiveFormData,
    variableValues,
    isElementCurrentlyVisible,
    isFieldCurrentlyRequired,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    validateFieldValue,
  } = useFormVisibility({
    schema,
    formData,
    readOnly,
    currentPageIndex,
    setCurrentPageIndex,
    effectiveDeviceType,
    visibilityValidatorResults,
    fieldLookup,
    previousAnswerData,
    userHasCity,
    firstContractSignedAt,
    completedActionCount,
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
    draftLockedRef.current = true;
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
    if (uploadingAny) return;

    if (nextVisiblePageIndex !== null) {
      const result = await validatePage(currentPageIndex, true);
      if (!result.isValid) {
        trackValidationError(result.firstInvalidFieldId);
        return;
      }
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

  const submitCurrentPage = useCallback(async (): Promise<boolean> => {
    if (submittingRef.current) {
      return false;
    }
    submittingRef.current = true;
    setSubmitting(true);

    const finishSubmit = (result: boolean) => {
      submittingRef.current = false;
      setSubmitting(false);
      return result;
    };

    if (readOnly || !onSubmit || uploadingAny) {
      return finishSubmit(false);
    }

    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }

    if (nextVisiblePageIndex !== null) {
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) {
        setCurrentPageIndex(nextVisiblePageIndex);
      } else {
        trackValidationError(result.firstInvalidFieldId);
      }
      return finishSubmit(false);
    }

    const { isValid, firstInvalidPageIndex, firstInvalidFieldId } =
      await validateAllPages();
    if (!isValid) {
      trackValidationError(firstInvalidFieldId);
      if (
        typeof firstInvalidPageIndex === "number" &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        setCurrentPageIndex(firstInvalidPageIndex);
      }
      return finishSubmit(false);
    }

    const sanitizedAnswers = stripCardIds(
      filterAnswersByFieldIds(effectiveFormData, fieldLookup),
    );

    const sid = searchParams.get("sid") ?? searchParams.get("ref");

    const submissionPayload: SubmitFormDto = {
      answers: sanitizedAnswers,
      formSnapshotId,
      actionId,
      visibilityValidatorResults,
      deviceType,
      publicAnswers: resolvedPublicAnswers,
      phDistinctId,
      sessionReplayUrl,
      sid: sid ?? undefined,
    };

    try {
      return await onSubmit(submissionPayload);
    } catch {
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    actionId,
    currentPageIndex,
    deviceType,
    effectiveFormData,
    fieldLookup,
    form,
    formSnapshotId,
    nextVisiblePageIndex,
    onSubmit,
    phDistinctId,
    readOnly,
    resolvedPublicAnswers,
    searchParams,
    sessionReplayUrl,
    trackValidationError,
    uploadingAny,
    validateAllPages,
    validatePage,
    visibilityValidatorResults,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    await submitCurrentPage();
  };

  const validateForPreview = useCallback(async () => {
    await validatePage(currentPageIndex, true);
  }, [formData, form, onSubmit]);

  const toggleWithdrawalOption = (option: WithdrawalOption) => {
    setWithdrawalOption((previous) => (previous === option ? null : option));
  };

  const handleAbandon = (option: WithdrawalOption) => {
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required to abandon a form",
      );
    }
    const submissionPayload: SubmitFormDto = {
      answers: stripCardIds(formData),
      formSnapshotId,
      actionId,
      visibilityValidatorResults,
      deviceType,
      publicAnswers: resolvedPublicAnswers,
    };

    onAbandonAction?.({
      ...withdrawalFlagsFromOption(option),
      reason: customReason.trim(),
      partialFormData: submissionPayload,
    });
    setDropdownOpen(false);
  };

  // Persist progress when enabled
  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        formData,
        publicAnswers: publicAnswerOverrides,
        currentPageIndex,
        updatedAt: Date.now(),
      }),
    );
  }, [
    formData,
    publicAnswerOverrides,
    currentPageIndex,
    persistKey,
    storageKey,
    readOnly,
  ]);

  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.formData && typeof parsed.formData === "object") {
      const filtered = restorableAnswers(
        parsed.formData as Record<string, FormValue>,
        fieldLookup,
      );
      setFormData(applyDefaultValues(filtered, defaultValueMap));
    }
    if (parsed?.publicAnswers && typeof parsed.publicAnswers === "object") {
      const overrides: Record<string, boolean> = {};
      for (const [fieldId, value] of Object.entries(
        parsed.publicAnswers as Record<string, unknown>,
      )) {
        if (outputFieldIds.has(fieldId) && typeof value === "boolean") {
          overrides[fieldId] = value;
        }
      }
      if (Object.keys(overrides).length > 0) {
        setPublicAnswerOverrides((prev) => ({
          ...prev,
          ...overrides,
        }));
      }
    }
    if (typeof parsed?.currentPageIndex === "number") {
      const maxIdx = Math.max(0, (pageCount || 1) - 1);
      const idx = Math.min(Math.max(0, parsed.currentPageIndex), maxIdx);
      setCurrentPageIndex(idx);
    }
  }, [
    persistKey,
    baseStorageKey,
    readOnly,
    fieldLookup,
    storageKey,
    pageCount,
    defaultValueMap,
    outputFieldIds,
  ]);

  // When rendering a completed form, sync provided answers into local state
  useEffect(() => {
    if (!readOnly) return;
    if (completedFormResponse?.answers) {
      setFormData(
        filterAnswersByFieldIds(
          completedFormResponse.answers as Record<string, FormValue>,
          fieldLookup,
        ),
      );
    }
  }, [readOnly, completedFormResponse, fieldLookup]);

  useEffect(() => {
    if (
      initialPageIndex === undefined ||
      readOnly ||
      persistKey ||
      typeof initialPageIndex !== "number"
    ) {
      return;
    }
    const maxIdx = Math.max(0, (pageCount || 1) - 1);
    const normalized = Math.floor(initialPageIndex);
    const clamped = Math.min(Math.max(0, normalized), maxIdx);
    setCurrentPageIndex(clamped);
  }, [initialPageIndex, persistKey, readOnly, pageCount]);

  const prevPageIndexRef = useRef(currentPageIndex);
  useEffect(() => {
    if (prevPageIndexRef.current === currentPageIndex) {
      return;
    }
    prevPageIndexRef.current = currentPageIndex;
    const container = scrollContainerRef?.current;
    const top = formTopRef.current;
    if (container && top) {
      const rawScrollMarginTop = parseFloat(
        getComputedStyle(top).scrollMarginTop,
      );
      const scrollMarginTop = Number.isFinite(rawScrollMarginTop)
        ? rawScrollMarginTop
        : 0;
      const targetTop =
        top.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        scrollMarginTop;
      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "instant",
      });
    } else {
      top?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  }, [currentPageIndex]);

  useEffect(() => {
    clearFieldErrors();
  }, [schema]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    setFormData((prev) => applyDefaultValues(prev, defaultValueMap));
  }, [defaultValueMap, readOnly]);

  const handlePublicToggleChange = (fieldId: string, nextPublic: boolean) => {
    const defaultPublic =
      outputFieldDefaultPublic.get(fieldId) ?? userDefaultPublic;
    setPublicAnswerOverrides((prev) => {
      if (nextPublic === defaultPublic) {
        if (!(fieldId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      if (prev[fieldId] === nextPublic) {
        return prev;
      }
      return {
        ...prev,
        [fieldId]: nextPublic,
      };
    });
  };

  const renderField = (field: AnyField, index: number) => {
    const isOutputField = Boolean(field.output?.output);
    const defaultSharePublic =
      outputFieldDefaultPublic.get(field.id) ?? userDefaultPublic;
    const sharePublicly = resolvedPublicAnswers[field.id] ?? defaultSharePublic;
    const useMakePublicToggle = Boolean(field.output?.privateByDefault);
    const toggleLabel = useMakePublicToggle
      ? outputFieldPublicToggle.showPublicly
      : outputFieldPublicToggle.hidePublicly;
    const toggleChecked = useMakePublicToggle ? sharePublicly : !sharePublicly;
    return (
      <div key={field.id || index}>
        <RenderField
          field={interpolateFieldText(field, variableValues)}
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
          formData={effectiveFormData}
          isElementVisible={isElementCurrentlyVisible}
          isFieldRequired={isFieldCurrentlyRequired}
          fieldErrors={fieldErrors}
          responseHiddenFromOthers={isOutputField && !sharePublicly}
        />
        {isOutputField && (
          <label className="mt-2 flex items-center text-sm text-gray-500">
            <input
              type="checkbox"
              className="mr-2 h-4 w-4"
              checked={toggleChecked}
              disabled={readOnly}
              onChange={
                readOnly
                  ? undefined
                  : (event) => {
                      const nextPublic = useMakePublicToggle
                        ? event.target.checked
                        : !event.target.checked;
                      handlePublicToggleChange(field.id, nextPublic);
                    }
              }
            />
            {toggleLabel}
          </label>
        )}
      </div>
    );
  };

  const renderElement = (element: AnyField | DisplayBlock, index: number) => {
    if (isQuestionField(element)) {
      if (!isElementCurrentlyVisible(element)) {
        return null;
      }
      return renderField(element, index);
    }
    const resolvedBlock = resolveDisplayBlockForUser(element, activeUserKey);
    if (!isElementCurrentlyVisible(resolvedBlock)) {
      return null;
    }
    return (
      <RenderDisplayBlock
        key={resolvedBlock.id ?? `block-${index}`}
        block={interpolateDisplayBlock(resolvedBlock, variableValues)}
        previousAnswerData={previousAnswerData}
        previousAnswerSchemas={previousAnswerSchemas}
        userLocation={userLocationDisplayValue}
        userLocationLoading={currentUserLocationLoading}
      />
    );
  };

  if (unknownKind) {
    return (
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        role="alert"
      >
        <p className="font-medium">This form can&apos;t be displayed</p>
        <p className="mt-1 text-sm">Refreshing the page may fix the issue.</p>
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Content */}
        <div
          className={cn(
            "space-y-6",
            readOnly && schema.pages.length === 1 && "mb-0",
          )}
        >
          {currentPage !== null &&
            currentPage.fields.map((element, index) =>
              renderElement(element, index),
            )}
        </div>
        {/* Navigation */}
        <div className="flex flex-row justify-between items-end gap-x-2">
          <div className="flex flex-col gap-y-4 flex-1">
            {visiblePageIndices.length > 1 && (
              <div className="flex items-center space-x-3">
                {!isFirstPage && (
                  <BaseButton
                    variant={BaseButtonVariant.LightHover}
                    size={BaseButtonSize.MediumDynamic}
                    onClick={handlePrevious}
                  >
                    Previous
                  </BaseButton>
                )}
                <div>
                  <span className="text-zinc-500 whitespace-nowrap">
                    Page{" "}
                    {Math.max(
                      1,
                      visiblePageIndices.indexOf(currentPageIndex) + 1,
                    )}{" "}
                    of {visiblePageIndices.length}
                  </span>
                </div>
                {!isLastPage && (
                  <BaseButton
                    variant={BaseButtonVariant.Black}
                    size={BaseButtonSize.MediumDynamic}
                    onClick={handleNext}
                    disabled={uploadingAny}
                  >
                    Next
                  </BaseButton>
                )}
              </div>
            )}

            {isLastPage && (
              <>
                {readOnly ? null : onSubmit ? (
                  <div className="w-full">
                    {createAccountHref ? (
                      <a
                        href={createAccountHref}
                        className="flex w-full items-center justify-center rounded bg-green px-4 py-2 text-base font-medium text-white hover:bg-[#4d8c1d]"
                        style={{ fontWeight: 450 }}
                      >
                        {guestReferral.createAccountToSubmit}
                      </a>
                    ) : (
                      <div className="w-full">
                        <ConfettiWrapper
                          burstPlacement="local"
                          onTrigger={submitCurrentPage}
                          className="w-full"
                        >
                          {({
                            disabled: confettiDisabled,
                            onClick,
                            onKeyDown,
                            onPointerDown,
                          }) => (
                            <BaseButton
                              variant={BaseButtonVariant.Black}
                              className="w-full"
                              disabled={
                                submitting || confettiDisabled || uploadingAny
                              }
                              type="submit"
                              onClick={onClick}
                              onKeyDown={onKeyDown}
                              onPointerDown={onPointerDown}
                            >
                              {schema.submit?.label ||
                                (followUp ? "Submit" : "Complete")}
                            </BaseButton>
                          )}
                        </ConfettiWrapper>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    <BaseButton
                      variant={BaseButtonVariant.Black}
                      className="!cursor-not-allowed w-full"
                      onClick={validateForPreview}
                    >
                      {schema.submit?.label ||
                        (followUp ? "Submit" : "Complete")}
                      {" (Preview Mode)"}
                    </BaseButton>
                  </div>
                )}
              </>
            )}
            {uploadingAny && !readOnly && (
              <p className="text-zinc-500">{waitingForImageUpload}</p>
            )}
          </div>

          {onAbandonAction && !readOnly && !publicAction && !followUp && (
            <div className="relative">
              <BaseButton onClick={() => setDropdownOpen(!dropdownOpen)}>
                <Ellipsis size={15} />
              </BaseButton>
              <Dropdown
                isOpen={dropdownOpen}
                className="absolute top-[100%] right-0 gap-y-2 *:w-full w-[300px]"
                ref={ref}
              >
                <p className="mb-1 text-center">Withdrawal options</p>
                {WITHDRAWAL_OPTIONS.map((option) => (
                  <React.Fragment key={option}>
                    <BaseButton
                      className={cn(
                        "justify-start",
                        withdrawalOption === option && "bg-zinc-100",
                      )}
                      iconLeft={WITHDRAWAL_OPTION_ICONS[option]}
                      onClick={() => toggleWithdrawalOption(option)}
                    >
                      {WITHDRAWAL_OPTION_LABELS[option]}
                    </BaseButton>
                    {option === "moral" && (
                      <BaseButton
                        className="justify-start"
                        iconLeft={TreePalm}
                        onClick={() => navigate("/membership#away-periods")}
                      >
                        On vacation
                      </BaseButton>
                    )}
                  </React.Fragment>
                ))}
                {withdrawalOption !== null && (
                  <>
                    <textarea
                      className="w-full h-20 border border-gray-300 rounded-md px-3 py-2 bg-white"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Explain in more detail..."
                    />
                    <BaseButton
                      variant={BaseButtonVariant.Black}
                      onClick={() => handleAbandon(withdrawalOption)}
                      disabled={
                        submitting ||
                        !canSubmitWithdrawal(withdrawalOption, customReason)
                      }
                    >
                      Withdraw
                    </BaseButton>
                  </>
                )}
              </Dropdown>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default FormRenderer;
