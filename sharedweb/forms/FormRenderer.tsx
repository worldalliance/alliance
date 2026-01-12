import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { UserDto } from "@alliance/shared/client";
import {
  FormResponseDto,
  SubmitFormDto,
  imagesUploadImage,
  tasksRunValidator,
} from "@alliance/shared/client";
import { useOutsideClick } from "../../sharedweb/lib/useOutsideClick";
import Button, { ButtonColor } from "../ui/Button";
import Dropdown from "../ui/Dropdown";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";
import type { DisplayBlock } from "@alliance/shared/forms/display-blocks";
import type {
  AnyField,
  DeviceVisibilityTarget,
  FormSchema,
  FormValue,
} from "@alliance/shared/forms/formschema";
import {
  applyDefaultValues,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  resolveFieldDefaultValue,
  validateFieldValue as validateFieldValueShared,
} from "@alliance/shared/formrenderer";
import { useSearchParams } from "react-router";

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
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  onSubmit: ((data: SubmitFormDto) => Promise<void>) | null; // null for admin preview
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
  completedFormResponse,
  actionId,
  initialPageIndex,
  sessionReplayUrl,
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
        }
      }
    }

    return { fieldLookup: lookup, defaultValueMap: defaults };
  }, [schema]);

  const pageCount = schema.pages?.length ?? 0;
  const maxPageIndex = Math.max(0, (pageCount || 1) - 1);

  const outputFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if ("label" in element) {
          const field = element as AnyField;
          if (field.output?.output) {
            ids.add(field.id);
          }
        }
      }
    }
    return ids;
  }, [schema]);

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

  const [publicAnswers, setPublicAnswers] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    if (!outputFieldIds || outputFieldIds.size === 0 || !user) return;

    setPublicAnswers((prev) => {
      if (prev && Object.keys(prev).length > 0) {
        return prev;
      }

      const next: Record<string, boolean> = {};
      for (const fieldId of outputFieldIds) {
        next[fieldId] = user.formDataPreference === "public" ? true : false;
      }

      return next;
    });
  }, [outputFieldIds, user]);

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
    for (const page of schema.pages) {
      for (const element of page.fields) {
        const conditions = Array.isArray(element.visibleIf)
          ? element.visibleIf
          : element.visibleIf
          ? [element.visibleIf]
          : [];
        for (const condition of conditions) {
          if ("validatorId" in condition) {
            ids.add(condition.validatorId);
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

  const applyFieldErrorUpdates = useCallback(
    (updates: Record<string, string | null>) => {
      if (!updates || Object.keys(updates).length === 0) return;

      setFieldErrors((prev) => {
        let changed = false;
        const next = { ...prev };
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
        readOnly,
      }),
    [effectiveDeviceType, formData, readOnly, visibilityValidatorResults]
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
      }),
    [effectiveDeviceType, formData, visibilityValidatorResults]
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

      applyFieldErrorUpdates(updates);

      const firstInvalid = visibleFields.find((field) => {
        const message = updates[field.id];
        return !!(message && message.trim().length > 0);
      });

      return {
        isValid: !firstInvalid,
        firstInvalidFieldId: firstInvalid?.id,
      };
    },
    [
      schema,
      formData,
      isElementCurrentlyVisible,
      validateFieldValue,
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
          applyFieldErrorUpdates({ [fieldId]: requiredError });
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
            const { data } = await imagesUploadImage({
              body: { file: reader.result },
            });
            if (data) {
              updateField(fieldId, data.key);
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
      publicAnswers,
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
      publicAnswers,
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
        publicAnswers,
        currentPageIndex,
        updatedAt: Date.now(),
      })
    );
  }, [
    formData,
    publicAnswers,
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
      setPublicAnswers((prev) => ({
        ...prev,
        ...(parsed.publicAnswers as Record<string, boolean>),
      }));
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
    const snapshot = (
      completedFormResponse as {
        publicAnswers?: Record<string, boolean>;
      }
    )?.publicAnswers;
    if (snapshot) {
      setPublicAnswers(snapshot);
      return;
    }
    setPublicAnswers((prev) => {
      const next: Record<string, boolean> = {};
      for (const fieldId of outputFieldIds) {
        next[fieldId] =
          fieldId in prev
            ? prev[fieldId]
            : user?.formDataPreference === "public"
            ? true
            : false;
      }
      return next;
    });
  }, [completedFormResponse, fieldLookup, outputFieldIds, readOnly]);

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

  useEffect(() => {
    setFieldErrors({});
  }, [schema]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    setFormData((prev) => applyDefaultValues(prev, defaultValueMap));
  }, [defaultValueMap, readOnly]);

  const handlePublicToggleChange = (fieldId: string, checked: boolean) => {
    setPublicAnswers((prev) => ({
      ...prev,
      [fieldId]: !checked,
    }));
  };

  const renderField = (field: AnyField, index: number) => {
    const isOutputField = Boolean(field.output?.output);
    const sharePublicly =
      publicAnswers[field.id] ?? user?.formDataPreference === "public";
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
        />
        {isOutputField && (
          <label className="mt-2 flex items-center text-sm text-gray-500">
            <input
              type="checkbox"
              className="mr-2 h-4 w-4"
              checked={!sharePublicly}
              disabled={readOnly}
              onChange={
                readOnly
                  ? undefined
                  : (event) =>
                      handlePublicToggleChange(field.id, event.target.checked)
              }
            />
            Hide my response from others
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
    return <RenderDisplayBlock key={index} block={resolvedBlock} />;
  };

  return (
    <div className="mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Content */}
        <div
          className={`space-y-6 ${
            readOnly && schema.pages.length === 1 ? "mb-0" : ""
          }`}
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
                  <Button
                    color={ButtonColor.LightHover}
                    type="button"
                    size="mediumDynamic"
                    onClick={handlePrevious}
                    className=""
                  >
                    Previous
                  </Button>
                )}
                <div>
                  <span className="text-zinc-500 whitespace-nowrap">
                    Page {currentPageIndex + 1} of {schema.pages.length}
                  </span>
                </div>
                {!isLastPage && (
                  <Button
                    color={ButtonColor.Black}
                    type="button"
                    size="mediumDynamic"
                    onClick={handleNext}
                    className=""
                  >
                    Next
                  </Button>
                )}
              </div>
            )}

            {isLastPage && (
              <>
                {readOnly ? null : onSubmit ? (
                  <div className="flex flex-1 space-x-2 items-center">
                    <Button
                      color={ButtonColor.Black}
                      type="submit"
                      className="w-full !py-3 !text-base"
                      disabled={submitting}
                    >
                      {schema.submit?.label || "Complete"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-1 space-x-2 items-center">
                    <Button
                      color={ButtonColor.Black}
                      className="!cursor-not-allowed w-full !py-3 !text-base"
                      onClick={validateForPreview}
                    >
                      {schema.submit?.label || "Complete"} (Preview Mode)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {onAbandonAction && !readOnly && !publicAction && (
            <div className="relative">
              <Button
                color={ButtonColor.White}
                className="px-4 flex items-center cursor-pointer justify-center mt-0 text-zinc-800  !w-[45px] !h-[45px]"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                ⋯
              </Button>
              <Dropdown
                isOpen={dropdownOpen}
                className="absolute top-[100%] right-0 gap-y-2 *:w-full w-[300px]"
                ref={ref}
              >
                <p className="mb-1 text-center">Withdrawal options</p>
                <Button
                  color={ButtonColor.White}
                  className={`!items-start !justify-start text-left !font-normal ${
                    outOfTimeSelected ? "!bg-zinc-200" : ""
                  }`}
                  onClick={handleOutOfTime}
                >
                  Took more than 15 minutes
                </Button>
                <Button
                  color={ButtonColor.White}
                  className={`!items-start !justify-start text-left !font-normal ${
                    otherReasonSelected ? "!bg-zinc-100" : ""
                  }`}
                  onClick={handleOtherReason}
                >
                  Other reason
                </Button>
                {(otherReasonSelected || outOfTimeSelected) && (
                  <>
                    <textarea
                      className="w-full h-20 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Explain in more detail..."
                    />
                    <Button
                      color={ButtonColor.Black}
                      onClick={handleAbandon}
                      className="w-full"
                    >
                      Withdraw
                    </Button>
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
