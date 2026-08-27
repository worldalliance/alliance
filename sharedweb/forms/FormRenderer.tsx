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
  collectSourceFormIds,
  collectVariableInputFields,
  isQuestionField,
  variableInputFieldsById,
  type AnyField,
  type CityFieldValue,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import {
  interpolateDisplayBlock,
  interpolateFieldText,
} from "@alliance/common/forms/variable-interpolation";
import { resolveVariableValues } from "@alliance/common/forms/variables";
import {
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  isFieldConditionallyRequired,
  stripHiddenAnswers,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { R } from "@alliance/common/result";
import {
  FormResponseDto,
  SubmitFormDto,
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  tasksGetMyFormResponse,
  tasksRunValidator,
  userMyLocation,
  type UserDto,
} from "@alliance/shared/client";
import {
  applyDefaultValues,
  collectManualSourceFormIds,
  computeActiveUserKey,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  findUnknownConditionKind,
  findUnknownFormElementKind,
  getFallbackVisiblePageIndex,
  getListSubFieldErrors,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  getVisiblePageIndices,
  resolveDisplayBlockForUser,
  resolveFieldDefaultValue,
  restorableAnswers,
  validateFieldValue as validateFieldValueShared,
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
import { parseVisibilityValidatorResults } from "@alliance/shared/parsed-dtos";
import { cn } from "@alliance/shared/styles/util";
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
  const randomizationKey = useMemo(() => {
    const base = `form:${id}`;
    if (activeUserKey) {
      return `${base}:user:${activeUserKey}`;
    }
    if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
      return `${base}:persist:${String(persistKey)}`;
    }
    return base;
  }, [id, activeUserKey, persistKey]);

  const [searchParams] = useSearchParams();

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const lookup = new Map<string, AnyField>();
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (isQuestionField(element)) {
          lookup.set(element.id, element);
          const defaultValue = resolveFieldDefaultValue(element);
          if (defaultValue !== undefined) {
            defaults.set(element.id, defaultValue);
          }
          // Include list sub-fields so conditional visibility can reference them
          if (element.kind === "list" && Array.isArray(element.fields)) {
            for (const sub of element.fields) {
              lookup.set(sub.id, sub);
            }
          }
        }
      }
    }

    return { fieldLookup: lookup, defaultValueMap: defaults };
  }, [schema]);

  const unknownKind = useMemo(
    () =>
      findUnknownFormElementKind(schema) ?? findUnknownConditionKind(schema),
    [schema],
  );
  const hasUserLocationDisplayBlock = useMemo(
    () =>
      schema.pages?.some((page) =>
        page.fields?.some(
          (element) =>
            !isQuestionField(element) && element.kind === "userLocation",
        ),
      ) ?? false,
    [schema],
  );

  const pageCount = schema.pages?.length ?? 0;
  const maxPageIndex = Math.max(0, (pageCount || 1) - 1);
  const userDefaultPublic = user?.formDataPreference === "public";

  const outputFieldDefaultPublic = useMemo(() => {
    const defaults = new Map<string, boolean>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if (isQuestionField(element)) {
          if (element.output?.output) {
            defaults.set(
              element.id,
              element.output.privateByDefault ? false : userDefaultPublic,
            );
          }
        }
      }
    }
    return defaults;
  }, [schema, userDefaultPublic]);

  const outputFieldIds = useMemo(
    () => new Set<string>(outputFieldDefaultPublic.keys()),
    [outputFieldDefaultPublic],
  );

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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const [currentUserLocation, setCurrentUserLocation] =
    useState<CityFieldValue | null>(null);
  const [currentUserLocationLoading, setCurrentUserLocationLoading] =
    useState(false);

  useEffect(() => {
    if (!loadCurrentUserLocation || !hasUserLocationDisplayBlock || !user) {
      setCurrentUserLocation(null);
      setCurrentUserLocationLoading(false);
      return;
    }

    let cancelled = false;
    setCurrentUserLocation(null);
    setCurrentUserLocationLoading(true);

    userMyLocation()
      .then((response) => {
        if (cancelled) return;
        setCurrentUserLocation(response.data?.city ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentUserLocation(null);
      })
      .finally(() => {
        if (cancelled) return;
        setCurrentUserLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasUserLocationDisplayBlock, loadCurrentUserLocation, user?.id, user]);

  const userLocationDisplayValue =
    currentUserLocation ?? user?.customCityString ?? null;

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

  const visibilityValidatorIds = useMemo(() => {
    const ids = new Set<number>();
    const collectFromVisibleIfFormula = (
      visibleIfFormula: VisibleIfFormula | undefined,
    ) => {
      if (!visibleIfFormula?.conditions) {
        return;
      }
      for (const condition of Object.values(visibleIfFormula.conditions)) {
        if (condition.kind === "validator") {
          ids.add(condition.validatorId);
        }
      }
    };
    for (const page of schema.pages) {
      collectFromVisibleIfFormula(page.visibleIfFormula);
      for (const element of page.fields) {
        collectFromVisibleIfFormula(element.visibleIfFormula);
        if (isQuestionField(element) && element.kind === "list") {
          if (Array.isArray(element.fields)) {
            for (const sub of element.fields) {
              collectFromVisibleIfFormula(sub.visibleIfFormula);
            }
          }
        }
      }
    }
    return Array.from(ids);
  }, [schema]);

  const [fetchedVisibilityValidatorResults, setVisibilityValidatorResults] =
    useState<Record<number, boolean>>({});

  // A response saved before a validator was added has no verdict for it, and a
  // missing verdict reads as hidden, so default to passing.
  const savedVisibilityValidatorResults = useMemo(() => {
    const defaults: Record<number, boolean> = {};
    for (const id of visibilityValidatorIds) {
      defaults[id] = true;
    }
    return {
      ...defaults,
      ...R.unwrapOr(
        parseVisibilityValidatorResults(
          completedFormResponse?.visibilityValidatorResults,
        ),
        {},
      ),
    };
  }, [
    visibilityValidatorIds,
    completedFormResponse?.visibilityValidatorResults,
  ]);

  const visibilityValidatorResults = readOnly
    ? savedVisibilityValidatorResults
    : fetchedVisibilityValidatorResults;

  // Drop verdicts for validators the schema no longer references. Returning
  // `prev` when there are none matters: a fresh object here re-runs the fetch
  // below, which would request every validator a second time on mount.
  useEffect(() => {
    if (readOnly) {
      return;
    }
    setVisibilityValidatorResults((prev) => {
      const referenced = new Set(visibilityValidatorIds);
      const kept = Object.entries(prev).filter(([id]) =>
        referenced.has(Number(id)),
      );
      if (kept.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(kept);
    });
  }, [visibilityValidatorIds, readOnly]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    const missingIds = visibilityValidatorIds.filter(
      (id) => !(id in fetchedVisibilityValidatorResults),
    );
    if (!missingIds.length) {
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (validatorId) => {
          try {
            const response = await tasksRunValidator({
              path: { id: validatorId },
              body: {},
            });
            if (!response.data || response.error) {
              throw response.error ?? new Error("Missing validator response");
            }
            return [validatorId, response.data.isValid] as const;
          } catch (error) {
            console.error(
              `Failed to evaluate visibility validator ${validatorId}`,
              error,
            );
            return [validatorId, false] as const;
          }
        }),
      );
      if (cancelled) return;
      setVisibilityValidatorResults((prev) => {
        const next = { ...prev };
        for (const [id, value] of entries) {
          next[id] = value;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [visibilityValidatorIds, fetchedVisibilityValidatorResults, readOnly]);

  // --- Previous Answer block data fetching ---
  const previousAnswerSourceFormIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (!isQuestionField(element) && element.kind === "previousAnswer") {
          if (element.sourceFormId) {
            ids.add(element.sourceFormId);
          }
          for (const id of collectManualSourceFormIds(element)) {
            ids.add(id);
          }
        }
        // Also collect from list fields with prefillFromPreviousAnswer
        if (isQuestionField(element) && element.kind === "list") {
          if (element.prefillFromPreviousAnswer?.sourceFormId) {
            ids.add(element.prefillFromPreviousAnswer.sourceFormId);
          }
        }
      }
    }
    for (const id of collectSourceFormIds(schema)) {
      ids.add(id);
    }
    return Array.from(ids);
  }, [schema]);

  const [previousAnswerSchemas, setPreviousAnswerSchemas] = useState<
    Record<number, FormSchema>
  >({});
  const [previousAnswerData, setPreviousAnswerData] = useState<
    Record<number, Record<string, unknown>>
  >({});

  useEffect(() => {
    if (previousAnswerSourceFormIds.length === 0) return;
    let cancelled = false;

    (async () => {
      const schemaEntries = await Promise.all(
        previousAnswerSourceFormIds.map(async (formId) => {
          try {
            const response = await tasksGetForm({ path: { id: formId } });
            if (response.data) {
              const form = response.data as Record<string, unknown>;
              return [formId, form.schema as FormSchema] as const;
            }
          } catch {
            // form not found or inaccessible
          }
          return null;
        }),
      );
      if (cancelled) return;
      const schemas: Record<number, FormSchema> = {};
      for (const entry of schemaEntries) {
        if (entry) schemas[entry[0]] = entry[1];
      }
      setPreviousAnswerSchemas(schemas);

      const previewId =
        adminPreviewUserId !== undefined && adminPreviewUserId !== null
          ? String(adminPreviewUserId)
          : null;

      const dataEntries = await Promise.all(
        previousAnswerSourceFormIds.map(async (formId) => {
          try {
            if (previewId) {
              // Admin preview: fetch all responses and find the one for the target user
              const response = await tasksGetFormResponsesAdmin({
                path: { id: formId },
              });
              const allResponses = (response.data ?? []) as Array<
                FormResponseDto & { user?: { id: number | string } }
              >;
              const match = allResponses.find(
                (r) => String(r.user?.id) === previewId,
              );
              if (match) {
                return [
                  formId,
                  (match.answers as Record<string, unknown>) ?? {},
                ] as const;
              }
            } else {
              const response = await tasksGetMyFormResponse({
                path: { id: formId },
              });
              if (response.data) {
                const resp = response.data as Record<string, unknown>;
                return [
                  formId,
                  (resp.answers as Record<string, unknown>) ?? {},
                ] as const;
              }
            }
          } catch {
            // user hasn't submitted this form — graceful 404
          }
          return null;
        }),
      );
      if (cancelled) return;
      const data: Record<number, Record<string, unknown>> = {};
      for (const entry of dataEntries) {
        if (entry) data[entry[0]] = entry[1];
      }
      setPreviousAnswerData(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [previousAnswerSourceFormIds, adminPreviewUserId]);

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

  const applyFieldErrorUpdates = useCallback(
    (
      updates: Record<string, string | null>,
      clearKeysWithPrefix?: string | string[],
    ) => {
      const hasUpdates = updates && Object.keys(updates).length > 0;
      const hasClear =
        clearKeysWithPrefix !== undefined &&
        (Array.isArray(clearKeysWithPrefix)
          ? clearKeysWithPrefix.length > 0
          : true);
      if (!hasUpdates && !hasClear) return;

      setFieldErrors((prev) => {
        let changed = false;
        const next = { ...prev };
        const prefixes = Array.isArray(clearKeysWithPrefix)
          ? clearKeysWithPrefix
          : clearKeysWithPrefix
            ? [clearKeysWithPrefix]
            : [];
        for (const prefix of prefixes) {
          const p = prefix + ":";
          for (const key of Object.keys(next)) {
            if (key.startsWith(p)) {
              delete next[key];
              changed = true;
            }
          }
        }
        if (updates) {
          for (const [fieldId, message] of Object.entries(updates)) {
            if (message && message.trim().length > 0) {
              if (next[fieldId] !== message) {
                next[fieldId] = message;
                changed = true;
              }
            } else if (fieldId in next) {
              delete next[fieldId];
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  // The single source of the account/device/validator state every visibility
  // and requiredness evaluation reads. Built once so a new condition kind is
  // added here rather than at each call site — miss one and it would silently
  // evaluate against the guest default, since every key is optional.
  const visibilityExtras = useMemo<ConditionExtras>(
    () => ({
      deviceType: effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      firstContractSignedAt,
      completedActionCount,
    }),
    [
      effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      firstContractSignedAt,
      completedActionCount,
    ],
  );

  // `readOnly` isn't part of `ConditionExtras` — only the element/page
  // visibility helpers take it, to treat a completed form's fields as visible.
  const visibilityExtrasReadOnly = useMemo(
    () => ({ ...visibilityExtras, readOnly }),
    [visibilityExtras, readOnly],
  );

  // Answers for fields the user can't currently see, treated as never given:
  // visibility, validation, rendering, and the submitted payload all read
  // this, so what the user sees is exactly what submits. Raw formData still
  // holds the hidden values, so re-showing a field restores what the user
  // typed.
  const effectiveFormData = useMemo(
    () =>
      stripHiddenAnswers(
        schema.pages ?? [],
        formData,
        visibilityExtrasReadOnly,
      ),
    [schema.pages, formData, visibilityExtrasReadOnly],
  );

  const variableInputFields = useMemo(
    () => variableInputFieldsById(collectVariableInputFields(schema)),
    [schema],
  );

  const variableValues = useMemo(
    () =>
      resolveVariableValues(schema.variables, {
        answers: effectiveFormData,
        fields: variableInputFields,
      }),
    [schema.variables, effectiveFormData, variableInputFields],
  );

  const isElementCurrentlyVisible = useCallback(
    (
      element: AnyField | DisplayBlock,
      data?: Record<string, FormValue>,
    ): boolean =>
      isElementCurrentlyVisibleShared(
        element,
        data ?? effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [effectiveFormData, visibilityExtrasReadOnly],
  );

  // Mirrors `isElementCurrentlyVisible`: the same answers and extras, so the
  // label and input attributes agree with what `validateFieldValue` and the
  // server's submit-time check enforce.
  const isFieldCurrentlyRequired = useCallback(
    (field: AnyField, data?: Record<string, FormValue>): boolean =>
      isFieldConditionallyRequired(
        field,
        data ?? effectiveFormData,
        visibilityExtras,
      ),
    [effectiveFormData, visibilityExtras],
  );

  const visiblePageIndices = useMemo(
    () =>
      getVisiblePageIndices(
        schema.pages ?? [],
        effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [schema.pages, effectiveFormData, visibilityExtrasReadOnly],
  );

  const nextVisiblePageIndex = useMemo(
    () => getNextVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  const previousVisiblePageIndex = useMemo(
    () => getPreviousVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  // If answers change and hide the current page, move to the nearest visible
  // page.
  useEffect(() => {
    const fallback = getFallbackVisiblePageIndex(
      visiblePageIndices,
      currentPageIndex,
    );
    if (fallback !== null) {
      setCurrentPageIndex(fallback);
    }
  }, [visiblePageIndices, currentPageIndex]);

  const validateFieldValue = useCallback(
    (
      field: AnyField,
      fieldValue: FormValue | undefined,
      data?: Record<string, FormValue>,
    ): string | null =>
      validateFieldValueShared(
        field,
        fieldValue,
        data ?? effectiveFormData,
        visibilityExtras,
      ),
    [effectiveFormData, visibilityExtras],
  );

  const runCustomValidatorsForFields = useCallback(
    async (
      fieldsToValidate: AnyField[],
    ): Promise<Record<string, string | null>> => {
      if (!fieldsToValidate.length || readOnly) {
        return {};
      }

      const results = await Promise.all(
        fieldsToValidate.map(async (field) => {
          if (!field.customValidatorId) {
            return [field.id, null] as const;
          }

          try {
            const response = await tasksRunValidator({
              path: { id: field.customValidatorId },
              body: {
                fieldValue: effectiveFormData[field.id]?.toString() ?? "",
              },
            });

            if (response.error || !response.data) {
              throw response.error;
            }

            const isValid = response.data.isValid;
            return [
              field.id,
              isValid ? null : (response.data.message ?? null),
            ] as const;
          } catch (err) {
            console.error("Failed to run custom validator", err);
            return [
              field.id,
              "Unable to validate this field right now. Please try again.",
            ] as const;
          }
        }),
      );

      return Object.fromEntries(results);
    },
    [readOnly, effectiveFormData],
  );

  const validatePage = useCallback(
    async (
      pageIndex: number,
      includeCustomValidators: boolean,
    ): Promise<{ isValid: boolean; firstInvalidFieldId?: string }> => {
      const page = schema.pages[pageIndex];
      if (!page) {
        return { isValid: true };
      }

      const updates: Record<string, string | null> = {};
      const fieldsOnPage = page.fields.filter(isQuestionField);
      // Fields on a hidden page are treated as invisible: errors clear and
      // nothing blocks navigation or submission.
      const pageVisible = visiblePageIndices.includes(pageIndex);
      const visibleFields = pageVisible
        ? fieldsOnPage.filter((field) => isElementCurrentlyVisible(field))
        : [];
      const visibleFieldIds = new Set(visibleFields.map((field) => field.id));

      for (const field of fieldsOnPage) {
        if (!visibleFieldIds.has(field.id)) {
          updates[field.id] = null;
          continue;
        }
        const fieldValue = effectiveFormData[field.id];
        updates[field.id] = validateFieldValue(field, fieldValue);
        if (field.kind === "list") {
          const subErrors = getListSubFieldErrors(
            field,
            fieldValue,
            effectiveFormData,
            visibilityExtras,
          );
          Object.assign(updates, subErrors);
        }
      }

      if (includeCustomValidators && !readOnly) {
        const candidates = visibleFields.filter(
          (field) => field.customValidatorId && !updates[field.id],
        );
        if (candidates.length > 0) {
          const customResults = await runCustomValidatorsForFields(candidates);
          Object.assign(updates, customResults);
        }
      }

      const listFieldIds = visibleFields
        .filter((f) => f.kind === "list")
        .map((f) => f.id);
      applyFieldErrorUpdates(
        updates,
        listFieldIds.length > 0 ? listFieldIds : undefined,
      );

      const hasAnyError = Object.values(updates).some(
        (msg) => msg && msg.trim().length > 0,
      );
      const firstInvalid = visibleFields.find((field) => {
        const message = updates[field.id];
        return !!(message && message.trim().length > 0);
      });
      const firstInvalidFieldId =
        firstInvalid?.id ??
        (hasAnyError
          ? (() => {
              const key = Object.keys(updates).find(
                (k) => updates[k] && updates[k]!.trim().length > 0,
              );
              return key?.includes(":") ? key.split(":")[0] : key;
            })()
          : undefined);

      return {
        isValid: !hasAnyError,
        firstInvalidFieldId,
      };
    },
    [
      schema,
      effectiveFormData,
      isElementCurrentlyVisible,
      visiblePageIndices,
      validateFieldValue,
      getListSubFieldErrors,
      visibilityExtras,
      runCustomValidatorsForFields,
      applyFieldErrorUpdates,
      readOnly,
    ],
  );

  const validateAllPages = useCallback(async () => {
    let firstInvalidPageIndex: number | null = null;
    let firstInvalidFieldId: string | undefined;

    for (let pageIndex = 0; pageIndex < schema.pages.length; pageIndex += 1) {
      const result = await validatePage(pageIndex, true);
      if (!result.isValid && firstInvalidPageIndex === null) {
        firstInvalidPageIndex = pageIndex;
        firstInvalidFieldId = result.firstInvalidFieldId;
      }
    }

    return {
      isValid: firstInvalidPageIndex === null,
      firstInvalidPageIndex,
      firstInvalidFieldId,
    } as const;
  }, [schema.pages.length, validatePage]);

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
    setFieldErrors({});
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
