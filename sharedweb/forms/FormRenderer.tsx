import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UserDto } from "@alliance/shared/client";
import {
  FormResponseDto,
  SubmitFormDto,
  imagesUploadImage,
  tasksRunValidator,
  tasksGetForm,
  tasksGetMyFormResponse,
  tasksGetFormResponses,
} from "@alliance/shared/client";
import { useOutsideClick } from "../../sharedweb/lib/useOutsideClick";
import Dropdown from "../ui/Dropdown";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";
import type {
  DisplayBlock,
  PreviousAnswerBlock,
} from "@alliance/shared/forms/display-blocks";
import type {
  AnyField,
  DeviceVisibilityTarget,
  FormSchema,
  FormValue,
  ListField,
  VisibleIfFormula,
} from "@alliance/shared/forms/formschema";
import {
  applyDefaultValues,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  resolveFieldDefaultValue,
  validateFieldValue as validateFieldValueShared,
  getListSubFieldErrors,
} from "@alliance/shared/formrenderer";
import { useSearchParams } from "react-router";
import {
  useFormPageDurationTracking,
  useFormValidationErrorTracking,
} from "./formAnalytics";
import BaseButton, {
  BaseButtonSize,
  BaseButtonVariant,
} from "../ui/BaseButton";
import { Ellipsis } from "lucide-react";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  publicAction?: boolean;
  actionId: number;
  persistKey?: string | null;
  initialPageIndex?: number;
  userId?: string | number;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  user?: Omit<UserDto, "email">;
  disableOptionRandomization?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (
    outOfTime: boolean,
    reason: string,
    partialFormData: SubmitFormDto
  ) => void;
  followUp?: boolean;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  fieldLabelRightContent?: Record<string, React.ReactNode>;
  /** When set, previousAnswer blocks fetch this user's responses via the admin all-responses endpoint. */
  adminPreviewUserId?: string | number;
  onSubmit: ((data: SubmitFormDto) => Promise<void>) | null; // null for admin preview
} & (
  | {
      isGeneralUpdate?: false;
      onDismiss?: undefined;
    }
  | {
      isGeneralUpdate: true;
      onDismiss?: () => void;
    }
);

export { computeFormStorageKey };

type FieldKind = FormSchema["pages"][number]["fields"][number]["kind"];
const KNOWN_FIELD_KINDS_RECORD = {
  text: true,
  textarea: true,
  email: true,
  number: true,
  range: true,
  phone: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  file: true,
  city: true,
  contract: true,
  list: true,
  custom: true,
  header: true,
  label: true,
  divider: true,
  spacer: true,
  html: true,
  image: true,
  video: true,
  quote: true,
  biglink: true,
  previousAnswer: true,
} as const satisfies Record<FieldKind, unknown>;
const KNOWN_FIELD_KINDS = new Set(
  Object.keys(KNOWN_FIELD_KINDS_RECORD)
) as Set<FieldKind>;

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
  publicAction,
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
  fieldLabelRightContent,
  adminPreviewUserId,
  actionId,
  initialPageIndex,
  sessionReplayUrl,
  isGeneralUpdate,
  onDismiss,
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
  const randomizationKey = useMemo(() => {
    const base = `form:${id}`;
    const normalizedUserId =
      user?.id !== undefined && user?.id !== null ? user.id : userId;
    if (
      normalizedUserId !== undefined &&
      normalizedUserId !== null &&
      normalizedUserId !== ""
    ) {
      return `${base}:user:${String(normalizedUserId)}`;
    }
    if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
      return `${base}:persist:${String(persistKey)}`;
    }
    return base;
  }, [id, user?.id, userId, persistKey]);
  const activeUserKey = useMemo(() => {
    const normalizedUserId =
      user?.id !== undefined && user?.id !== null ? user.id : userId;
    if (normalizedUserId === undefined || normalizedUserId === null) {
      return undefined;
    }
    const asString = String(normalizedUserId);
    return asString.length > 0 ? asString : undefined;
  }, [user?.id, userId]);

  const [searchParams] = useSearchParams();

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const lookup = new Map<string, AnyField>();
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        if ("label" in element) {
          const field = element as AnyField;
          lookup.set(field.id, field);
          const defaultValue = resolveFieldDefaultValue(field);
          if (defaultValue !== undefined) {
            defaults.set(field.id, defaultValue);
          }
          // Include list sub-fields so conditional visibility can reference them
          if (field.kind === "list" && Array.isArray(field.fields)) {
            for (const sub of field.fields) {
              lookup.set(sub.id, sub);
            }
          }
        }
      }
    }

    return { fieldLookup: lookup, defaultValueMap: defaults };
  }, [schema]);

  const unknownKind = useMemo(() => {
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if (!KNOWN_FIELD_KINDS.has(element.kind)) {
          return element.kind;
        }
      }
    }
    return null;
  }, [schema]);

  const pageCount = schema.pages?.length ?? 0;
  const maxPageIndex = Math.max(0, (pageCount || 1) - 1);
  const userDefaultPublic = user?.formDataPreference === "public";

  const outputFieldDefaultPublic = useMemo(() => {
    const defaults = new Map<string, boolean>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if ("label" in element) {
          const field = element as AnyField;
          if (field.output?.output) {
            defaults.set(
              field.id,
              field.output.privateByDefault ? false : userDefaultPublic
            );
          }
        }
      }
    }
    return defaults;
  }, [schema, userDefaultPublic]);

  const outputFieldIds = useMemo(
    () => new Set<string>(outputFieldDefaultPublic.keys()),
    [outputFieldDefaultPublic]
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
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      const answers =
        (completedFormResponse?.answers as Record<string, FormValue>) || {};
      return filterAnswersByFieldIds(answers, fieldLookup);
    }

    if (typeof window === "undefined") {
      return applyDefaultValues(undefined, defaultValueMap);
    }

    if (!persistKey) {
      return applyDefaultValues({}, defaultValueMap);
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return applyDefaultValues({}, defaultValueMap);
      }
      const parsed = JSON.parse(raw);
      const storedFormData =
        parsed?.formData && typeof parsed.formData === "object"
          ? (parsed.formData as Record<string, FormValue>)
          : undefined;
      const filtered = storedFormData
        ? filterAnswersByFieldIds(storedFormData, fieldLookup)
        : {};
      return applyDefaultValues(filtered, defaultValueMap);
    } catch {
      return applyDefaultValues({}, defaultValueMap);
    }
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

  const [uploadingFields, setUploadingFields] = useState<Set<string>>(
    new Set()
  );
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const [deviceType, setDeviceType] = useState<DeviceVisibilityTarget>(() =>
    detectDeviceType()
  );
  const [submitting, setSubmitting] = useState(false);

  // Dropdown state for "decline to participate" options
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [otherReasonSelected, setOtherReasonSelected] = useState(false);
  const [outOfTimeSelected, setOutOfTimeSelected] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const ref = useOutsideClick(() => setDropdownOpen(false));

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
    ? savedDeviceType ?? deviceType
    : deviceType;

  const visibilityValidatorIds = useMemo(() => {
    const ids = new Set<number>();
    const collectFromConditions = (visibleIf: unknown) => {
      const conditions = Array.isArray(visibleIf)
        ? visibleIf
        : visibleIf
        ? [visibleIf]
        : [];
      for (const condition of conditions) {
        if (
          condition &&
          typeof condition === "object" &&
          "validatorId" in condition
        ) {
          ids.add((condition as { validatorId: number }).validatorId);
        }
      }
    };
    const collectFromVisibleIfFormula = (
      visibleIfFormula: VisibleIfFormula | undefined
    ) => {
      if (!visibleIfFormula?.conditions) {
        return;
      }
      for (const condition of Object.values(visibleIfFormula.conditions)) {
        if (condition && "validatorId" in condition) {
          ids.add(condition.validatorId);
        }
      }
    };
    for (const page of schema.pages) {
      for (const element of page.fields) {
        collectFromConditions(element.visibleIf);
        collectFromVisibleIfFormula(element.visibleIfFormula);
        if ("label" in element && (element as AnyField).kind === "list") {
          const listField = element as AnyField & { fields?: AnyField[] };
          if (Array.isArray(listField.fields)) {
            for (const sub of listField.fields) {
              collectFromConditions(sub.visibleIf);
              collectFromVisibleIfFormula(sub.visibleIfFormula);
            }
          }
        }
      }
    }
    return Array.from(ids);
  }, [schema]);

  const [visibilityValidatorResults, setVisibilityValidatorResults] = useState<
    Record<number, boolean>
  >(() => {
    if (readOnly && completedFormResponse?.visibilityValidatorResults) {
      return completedFormResponse.visibilityValidatorResults as Record<
        number,
        boolean
      >;
    }
    return {};
  });

  useEffect(() => {
    if (readOnly) {
      return;
    }
    setVisibilityValidatorResults((prev) => {
      let changed = false;
      const next: Record<number, boolean> = {};
      for (const id of visibilityValidatorIds) {
        if (Object.prototype.hasOwnProperty.call(prev, id)) {
          next[id] = prev[id];
        } else {
          changed = true;
        }
      }
      if (
        !changed &&
        Object.keys(prev).length === visibilityValidatorIds.length
      ) {
        return prev;
      }
      return next;
    });
  }, [visibilityValidatorIds, readOnly]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    const missingIds = visibilityValidatorIds.filter(
      (id) => !(id in visibilityValidatorResults)
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
              error
            );
            return [validatorId, false] as const;
          }
        })
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
  }, [visibilityValidatorIds, visibilityValidatorResults, readOnly]);

  // --- Previous Answer block data fetching ---
  const previousAnswerSourceFormIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (
          !("label" in element) &&
          (element as PreviousAnswerBlock).kind === "previousAnswer"
        ) {
          const block = element as PreviousAnswerBlock;
          if (block.sourceFormId) {
            ids.add(block.sourceFormId);
          }
        }
        // Also collect from list fields with prefillFromPreviousAnswer
        if ("label" in element && (element as AnyField).kind === "list") {
          const listField = element as ListField;
          if (listField.prefillFromPreviousAnswer?.sourceFormId) {
            ids.add(listField.prefillFromPreviousAnswer.sourceFormId);
          }
        }
      }
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
        })
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
              const response = await tasksGetFormResponses({
                path: { id: formId },
              });
              const allResponses = (response.data ?? []) as Array<
                FormResponseDto & { user?: { id: number | string } }
              >;
              const match = allResponses.find(
                (r) => String(r.user?.id) === previewId
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
        })
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

  // --- Prefill list fields from previous answer data ---
  useEffect(() => {
    if (readOnly) return;
    if (Object.keys(previousAnswerData).length === 0) return;

    setFormData((prev) => {
      const next = { ...prev };
      let didUpdate = false;

      for (const page of schema.pages) {
        for (const element of page.fields) {
          if (!("label" in element)) continue;
          const field = element as AnyField;
          if (field.kind !== "list") continue;
          const listField = field as ListField;
          const prefill = listField.prefillFromPreviousAnswer;
          if (!prefill) continue;

          // Only prefill if untouched (undefined, null, or array of all-empty objects from defaultNumber)
          const cur = next[field.id];
          const isUntouched =
            cur === undefined ||
            cur === null ||
            (Array.isArray(cur) &&
              cur.every(
                (c: unknown) =>
                  typeof c === "object" &&
                  c !== null &&
                  Object.keys(c as Record<string, unknown>).length === 0
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
            }
          );

          next[field.id] = prefilledCards;
          didUpdate = true;
        }
      }
      return didUpdate ? next : prev;
    });
  }, [previousAnswerData, schema, readOnly]);

  const applyFieldErrorUpdates = useCallback(
    (
      updates: Record<string, string | null>,
      clearKeysWithPrefix?: string | string[]
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
    []
  );

  const isElementCurrentlyVisible = useCallback(
    (
      element: AnyField | DisplayBlock,
      data?: Record<string, FormValue>
    ): boolean =>
      isElementCurrentlyVisibleShared(element, data ?? formData, {
        deviceType: effectiveDeviceType,
        visibilityValidatorResults,
        fieldLookup,
        readOnly,
      }),
    [
      effectiveDeviceType,
      fieldLookup,
      formData,
      readOnly,
      visibilityValidatorResults,
    ]
  );

  const resolveDisplayBlockForUser = useCallback<
    <T extends DisplayBlock>(candidate: T) => T
  >(
    (candidate) => {
      if (!candidate.manualPerUser || !activeUserKey) {
        return candidate;
      }
      const manualContent = candidate.manualUserContent?.[activeUserKey];
      if (!manualContent) {
        return candidate;
      }
      return {
        ...candidate,
        ...manualContent,
        manualPerUser: candidate.manualPerUser,
        manualUserContent: candidate.manualUserContent,
      };
    },
    [activeUserKey]
  );

  const validateFieldValue = useCallback(
    (
      field: AnyField,
      fieldValue: FormValue | undefined,
      data?: Record<string, FormValue>
    ): string | null =>
      validateFieldValueShared(field, fieldValue, data ?? formData, {
        deviceType: effectiveDeviceType,
        visibilityValidatorResults,
        fieldLookup,
      }),
    [effectiveDeviceType, formData, visibilityValidatorResults, fieldLookup]
  );

  const runCustomValidatorsForFields = useCallback(
    async (
      fieldsToValidate: AnyField[]
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
              body: { fieldValue: formData[field.id].toString() },
            });

            if (response.error || !response.data) {
              throw response.error;
            }

            const isValid = response.data.isValid;
            return [
              field.id,
              isValid ? null : response.data.message ?? null,
            ] as const;
          } catch (err) {
            console.error("Failed to run custom validator", err);
            return [
              field.id,
              "Unable to validate this field right now. Please try again.",
            ] as const;
          }
        })
      );

      return Object.fromEntries(results);
    },
    [readOnly, formData]
  );

  const validatePage = useCallback(
    async (
      pageIndex: number,
      includeCustomValidators: boolean
    ): Promise<{ isValid: boolean; firstInvalidFieldId?: string }> => {
      const page = schema.pages[pageIndex];
      if (!page) {
        return { isValid: true };
      }

      const updates: Record<string, string | null> = {};
      const fieldsOnPage = page.fields.filter(
        (element): element is AnyField => "label" in element
      );
      const visibleFields = fieldsOnPage.filter((field) =>
        isElementCurrentlyVisible(field)
      );
      const visibleFieldIds = new Set(visibleFields.map((field) => field.id));

      for (const field of fieldsOnPage) {
        if (!visibleFieldIds.has(field.id)) {
          updates[field.id] = null;
          continue;
        }
        const fieldValue = formData[field.id];
        updates[field.id] = validateFieldValue(field, fieldValue);
        if (field.kind === "list") {
          const subErrors = getListSubFieldErrors(field, fieldValue, formData, {
            deviceType: effectiveDeviceType,
            visibilityValidatorResults,
            fieldLookup,
          });
          Object.assign(updates, subErrors);
        }
      }

      if (includeCustomValidators && !readOnly) {
        const candidates = visibleFields.filter(
          (field) => field.customValidatorId && !updates[field.id]
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
        listFieldIds.length > 0 ? listFieldIds : undefined
      );

      const hasAnyError = Object.values(updates).some(
        (msg) => msg && msg.trim().length > 0
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
                (k) => updates[k] && updates[k]!.trim().length > 0
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
      formData,
      isElementCurrentlyVisible,
      validateFieldValue,
      getListSubFieldErrors,
      effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      runCustomValidatorsForFields,
      applyFieldErrorUpdates,
      readOnly,
    ]
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
    if (!hasEmittedStart) {
      try {
        onFormStarted?.();
      } finally {
        setHasEmittedStart(true);
      }
    }
  };

  const currentPage =
    currentPageIndex < schema.pages.length
      ? schema.pages[currentPageIndex]
      : null;
  const isLastPage = currentPageIndex === schema.pages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  const updateField = (fieldId: string, value: FormValue) => {
    if (readOnly) return;
    ensureStarted();
    setFormData((prev) => {
      const next = { ...prev, [fieldId]: value };
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
        } else {
          const requiredError = validateFieldValue(
            fieldDefinition,
            nextValue,
            next
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

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (readOnly) return;
    ensureStarted();
    setUploadingFields((prev) => new Set(prev).add(fieldId));
    setUploadErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          try {
            const { data, error } = await imagesUploadImage({
              body: { file: reader.result },
            });
            if (data) {
              updateField(fieldId, data.key);
            } else if (error) {
              setUploadErrors((prev) => ({
                ...prev,
                [fieldId]:
                  (error as Error)?.message ?? "Failed to upload image",
              }));
            }
          } catch (error) {
            console.error("Failed to upload image:", error);
            setUploadErrors((prev) => ({
              ...prev,
              [fieldId]: "Failed to upload image",
            }));
          }
        }
        setUploadingFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fieldId);
          return newSet;
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to read file:", error);
      setUploadErrors((prev) => ({
        ...prev,
        [fieldId]: "Failed to read file",
      }));
      setUploadingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fieldId);
        return newSet;
      });
    }
  };

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (readOnly) {
      if (!isLastPage) {
        setCurrentPageIndex((prev) => prev + 1);
      }
      return;
    }

    if (!isLastPage) {
      const result = await validatePage(currentPageIndex, true);
      if (!result.isValid) {
        trackValidationError(result.firstInvalidFieldId);
        return;
      }
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFirstPage) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (submitting) {
      return;
    }

    setSubmitting(true);

    if (readOnly || !onSubmit) {
      setSubmitting(false);
      return;
    }

    if (!isLastPage) {
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) {
        setCurrentPageIndex((prev) => prev + 1);
      } else {
        trackValidationError(result.firstInvalidFieldId);
      }
      setSubmitting(false);
      return;
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
      setSubmitting(false);
      return;
    }

    const sanitizedAnswers = filterAnswersByFieldIds(formData, fieldLookup);

    const sid = searchParams.get("sid");

    const submissionPayload: SubmitFormDto = {
      answers: sanitizedAnswers,
      schemaSnapshot: form as unknown as Record<string, unknown>,
      actionId,
      visibilityValidatorResults,
      deviceType,
      publicAnswers: resolvedPublicAnswers,
      phDistinctId,
      sessionReplayUrl,
      sid: sid ?? undefined,
    };

    onSubmit(submissionPayload).finally(() => {
      setSubmitting(false);
    });
  };

  const validateForPreview = useCallback(async () => {
    await validatePage(currentPageIndex, true);
  }, [formData, form, onSubmit]);

  const handleOutOfTime = () => {
    setOutOfTimeSelected(!outOfTimeSelected);
    if (otherReasonSelected) {
      setOtherReasonSelected(false);
    }
  };

  const handleOtherReason = () => {
    setOtherReasonSelected(!otherReasonSelected);
    if (outOfTimeSelected) {
      setOutOfTimeSelected(false);
    }
  };

  const handleAbandon = () => {
    const submissionPayload: SubmitFormDto = {
      answers: formData,
      schemaSnapshot: form as unknown as Record<string, unknown>,
      actionId,
      visibilityValidatorResults,
      deviceType,
      publicAnswers: resolvedPublicAnswers,
    };

    onAbandonAction?.(outOfTimeSelected, customReason, submissionPayload);
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
      })
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
      const filtered = filterAnswersByFieldIds(
        parsed.formData as Record<string, FormValue>,
        fieldLookup
      );
      setFormData(applyDefaultValues(filtered, defaultValueMap));
    }
    if (parsed?.publicAnswers && typeof parsed.publicAnswers === "object") {
      const overrides: Record<string, boolean> = {};
      for (const [fieldId, value] of Object.entries(
        parsed.publicAnswers as Record<string, unknown>
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
          fieldLookup
        )
      );
    }
  }, [readOnly, completedFormResponse, fieldLookup]);

  useEffect(() => {
    if (!readOnly) {
      return;
    }
    if (!visibilityValidatorIds.length) {
      return;
    }
    setVisibilityValidatorResults((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of visibilityValidatorIds) {
        if (!(id in next)) {
          next[id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [readOnly, visibilityValidatorIds]);

  useEffect(() => {
    if (!readOnly) {
      return;
    }
    if (!completedFormResponse?.visibilityValidatorResults) {
      return;
    }
    setVisibilityValidatorResults((prev) => {
      const normalized =
        completedFormResponse.visibilityValidatorResults as Record<
          number,
          boolean
        >;
      const keys = Object.keys(normalized);
      if (keys.length === Object.keys(prev).length) {
        let identical = true;
        for (const key of keys) {
          const numericKey = Number(key);
          if (!Number.isFinite(numericKey)) {
            continue;
          }
          if (prev[numericKey] !== normalized[numericKey]) {
            identical = false;
            break;
          }
        }
        if (identical) {
          return prev;
        }
      }
      return normalized;
    });
  }, [readOnly, completedFormResponse?.visibilityValidatorResults]);

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
    if (prevPageIndexRef.current !== currentPageIndex) {
      prevPageIndexRef.current = currentPageIndex;
      formTopRef.current?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  }, [currentPageIndex]);

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
      ? "Show my response to other members"
      : "Hide my response from others";
    const toggleChecked = useMakePublicToggle ? sharePublicly : !sharePublicly;
    return (
      <div key={field.id || index}>
        <RenderField
          field={field}
          value={formData[field.id]}
          onChange={readOnly ? undefined : (val) => updateField(field.id, val)}
          onFileSelected={
            readOnly ? undefined : (file) => handleFileUpload(field.id, file)
          }
          disabled={readOnly}
          uploading={uploadingFields.has(field.id)}
          uploadError={uploadErrors[field.id]}
          error={fieldErrors[field.id]}
          randomizationKey={
            disableOptionRandomization ? undefined : randomizationKey
          }
          disableOptionRandomization={disableOptionRandomization}
          user={user}
          labelRightAddon={fieldLabelRightContent?.[field.id]}
          formData={formData}
          isElementVisible={isElementCurrentlyVisible}
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
    if ("label" in element) {
      if (!isElementCurrentlyVisible(element)) {
        return null;
      }
      return renderField(element as AnyField, index);
    }
    const resolvedBlock = resolveDisplayBlockForUser(element as DisplayBlock);
    if (!isElementCurrentlyVisible(resolvedBlock)) {
      return null;
    }
    return (
      <RenderDisplayBlock
        key={index}
        block={resolvedBlock}
        previousAnswerData={previousAnswerData}
        previousAnswerSchemas={previousAnswerSchemas}
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

  return (
    <div ref={formTopRef} className="mx-auto scroll-mt-24">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Content */}
        <div
          className={cn(
            "space-y-6",
            readOnly && schema.pages.length === 1 && "mb-0"
          )}
        >
          {currentPage !== null &&
            currentPage.fields.map((element, index) =>
              renderElement(element, index)
            )}
        </div>
        {/* Navigation */}
        <div className="flex flex-row justify-between items-end gap-x-3">
          <div className="flex flex-col gap-y-4 flex-1">
            {schema.pages.length > 1 && (
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
                    Page {currentPageIndex + 1} of {schema.pages.length}
                  </span>
                </div>
                {!isLastPage && (
                  <BaseButton
                    variant={BaseButtonVariant.Black}
                    size={BaseButtonSize.MediumDynamic}
                    onClick={handleNext}
                  >
                    Next
                  </BaseButton>
                )}
              </div>
            )}

            {isLastPage && (
              <>
                {isGeneralUpdate ? (
                  onDismiss && (
                    <BaseButton
                      variant={BaseButtonVariant.LightHover}
                      onClick={onDismiss}
                      className="w-full"
                    >
                      Dismiss
                    </BaseButton>
                  )
                ) : readOnly ? null : onSubmit ? (
                  <div className="flex flex-1 space-x-2 items-center">
                    <BaseButton
                      variant={BaseButtonVariant.Black}
                      className="w-full"
                      disabled={submitting}
                      type="submit"
                    >
                      {schema.submit?.label ||
                        (followUp ? "Submit" : "Complete")}
                    </BaseButton>
                  </div>
                ) : (
                  <div className="flex flex-1 space-x-2 items-center">
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
                <BaseButton
                  className={cn(
                    "justify-start",
                    outOfTimeSelected && "bg-zinc-100"
                  )}
                  onClick={handleOutOfTime}
                >
                  Took more than 15 minutes
                </BaseButton>
                <BaseButton
                  className={cn(
                    "justify-start",
                    otherReasonSelected && "bg-zinc-100"
                  )}
                  onClick={handleOtherReason}
                >
                  Other reason
                </BaseButton>
                {(otherReasonSelected || outOfTimeSelected) && (
                  <>
                    <textarea
                      className="w-full h-20 border border-gray-300 rounded-md px-3 py-2 bg-white"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Explain in more detail..."
                    />
                    <BaseButton
                      variant={BaseButtonVariant.Black}
                      onClick={handleAbandon}
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
