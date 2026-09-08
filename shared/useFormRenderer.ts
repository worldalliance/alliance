/**
 * The headless half of the form renderer, shared by the web and native
 * renderers. Everything here is state, derivation and IO; anything that reads
 * `window` or returns an element stays in the platform component.
 */

import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import { type DisplayBlock } from "@alliance/common/forms/display-blocks";
import {
  collectGroupByFieldId,
  collectSourceFormIds,
  collectVariableInputFields,
  flattenPageItems,
  forEachCondition,
  isDisplayBlock,
  isQuestionField,
  variableInputFieldsById,
  type AnyField,
  type CityFieldValue,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import {
  emptyUserPropertyPresence,
  type UserPropertyPresence,
} from "@alliance/common/forms/user-properties";
import { resolveVariableValues } from "@alliance/common/forms/variables";
import {
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  isFieldConditionallyRequired,
  stripHiddenAnswers,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import { R } from "@alliance/common/result";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  tasksGetMyFormResponse,
  tasksRunValidator,
  userMyLocation,
  type UserDto,
} from "./client";
import {
  collectManualSourceFormIds,
  findUnknownConditionKind,
  findUnknownFormElementKind,
  getFallbackVisiblePageIndex,
  getListSubFieldErrors,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  getVisiblePageIndices,
  resolveFieldDefaultValue,
  validateFieldValue as validateFieldValueShared,
} from "./formrenderer";
import { parseVisibilityValidatorResults } from "./parsed-dtos";

export type FieldErrorUpdater = (
  updates: Record<string, string | null>,
  clearKeysWithPrefix?: string | string[],
) => void;

/**
 * Field-level error messages, keyed by field id. A list sub-field error is
 * keyed `parentId:cardIndex:subId`, which is what `clearKeysWithPrefix` clears
 * when passed the parent's id.
 */
export function useFieldErrors(): {
  fieldErrors: Record<string, string>;
  clearFieldErrors: () => void;
  applyFieldErrorUpdates: FieldErrorUpdater;
} {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const applyFieldErrorUpdates = useCallback<FieldErrorUpdater>(
    (updates, clearKeysWithPrefix) => {
      const hasUpdates = Object.keys(updates).length > 0;
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
    [],
  );

  const clearFieldErrors = useCallback(
    () => setFieldErrors((prev) => (Object.keys(prev).length ? {} : prev)),
    [],
  );

  return { fieldErrors, clearFieldErrors, applyFieldErrorUpdates };
}

/**
 * Seed for per-user answer randomization. Keyed on the acting user where there
 * is one so a member sees a stable order across devices, and on the persist key
 * otherwise so an anonymous draft stays stable across a reload.
 */
export function useRandomizationKey(args: {
  formId: number;
  activeUserKey: string | null | undefined;
  persistKey?: string | number | null;
}): string {
  const { formId, activeUserKey, persistKey } = args;
  return useMemo(() => {
    const base = `form:${formId}`;
    if (activeUserKey) {
      return `${base}:user:${activeUserKey}`;
    }
    if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
      return `${base}:persist:${String(persistKey)}`;
    }
    return base;
  }, [formId, activeUserKey, persistKey]);
}

export function useFormSchemaMaps(args: {
  schema: FormSchema;
  userDefaultPublic: boolean;
}): {
  fieldLookup: Map<string, AnyField>;
  defaultValueMap: Map<string, FormValue>;
  unknownKind: string | null;
  hasUserLocationDisplayBlock: boolean;
  outputFieldDefaultPublic: Map<string, boolean>;
  outputFieldIds: Set<string>;
  pageCount: number;
  maxPageIndex: number;
} {
  const { schema, userDefaultPublic } = args;

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const lookup = new Map<string, AnyField>();
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of flattenPageItems(page.fields)) {
        if (isQuestionField(element)) {
          lookup.set(element.id, element);
          const defaultValue = resolveFieldDefaultValue(element);
          if (defaultValue !== undefined) {
            defaults.set(element.id, defaultValue);
          }
          // List sub-fields are looked up too, so a condition can reference one.
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
        flattenPageItems(page.fields ?? []).some(
          (element) =>
            isDisplayBlock(element) && element.kind === "userLocation",
        ),
      ) ?? false,
    [schema],
  );

  const outputFieldDefaultPublic = useMemo(() => {
    const defaults = new Map<string, boolean>();
    for (const page of schema.pages ?? []) {
      for (const element of flattenPageItems(page.fields ?? [])) {
        if (isQuestionField(element) && element.output?.output) {
          defaults.set(
            element.id,
            element.output.privateByDefault ? false : userDefaultPublic,
          );
        }
      }
    }
    return defaults;
  }, [schema, userDefaultPublic]);

  const outputFieldIds = useMemo(
    () => new Set<string>(outputFieldDefaultPublic.keys()),
    [outputFieldDefaultPublic],
  );

  const pageCount = schema.pages?.length ?? 0;

  return {
    fieldLookup,
    defaultValueMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    pageCount,
    maxPageIndex: Math.max(0, (pageCount || 1) - 1),
  };
}

/** The signed-in user's stored city, for a `userLocation` display block. */
export function useCurrentUserLocation(args: {
  enabled: boolean;
  user: Pick<UserDto, "id" | "customCityString"> | null | undefined;
}): {
  currentUserLocationLoading: boolean;
  userLocationDisplayValue: CityFieldValue | string | null;
} {
  const { enabled, user } = args;
  const [currentUserLocation, setCurrentUserLocation] =
    useState<CityFieldValue | null>(null);
  const [currentUserLocationLoading, setCurrentUserLocationLoading] =
    useState(false);

  useEffect(() => {
    if (!enabled || !user) {
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
  }, [enabled, user?.id, user]);

  return {
    currentUserLocationLoading,
    userLocationDisplayValue:
      currentUserLocation ?? user?.customCityString ?? null,
  };
}

/**
 * The schemas and the user's answers for every form this one reads back:
 * `previousAnswer` display blocks, answer sources a variable or condition
 * names, and a list's prefill source.
 */
export function usePreviousAnswerSources(args: {
  schema: FormSchema;
  /** Admin preview: read this user's responses rather than the caller's. */
  previewUserId?: string | number | null;
}): {
  previousAnswerSchemas: Record<number, FormSchema>;
  previousAnswerData: Record<number, Record<string, unknown>>;
} {
  const { schema, previewUserId } = args;

  const sourceFormIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of flattenPageItems(page.fields)) {
        if (isDisplayBlock(element) && element.kind === "previousAnswer") {
          if (element.sourceFormId) {
            ids.add(element.sourceFormId);
          }
          for (const id of collectManualSourceFormIds(element)) {
            ids.add(id);
          }
        }
        if (
          isQuestionField(element) &&
          element.kind === "list" &&
          element.prefillFromPreviousAnswer?.sourceFormId
        ) {
          ids.add(element.prefillFromPreviousAnswer.sourceFormId);
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
    if (sourceFormIds.length === 0) {
      setPreviousAnswerSchemas({});
      setPreviousAnswerData({});
      return;
    }

    const previewId =
      previewUserId === undefined || previewUserId === null
        ? null
        : String(previewUserId);

    let cancelled = false;
    void (async () => {
      const schemaEntries = await Promise.all(
        sourceFormIds.map(async (formId) => {
          try {
            const response = await tasksGetForm({ path: { id: formId } });
            // Stored jsonb, written by a builder that validated it; nothing
            // re-checks it on the way back in.
            const stored: unknown = response.data?.schema;
            return stored ? ([formId, stored as FormSchema] as const) : null;
          } catch {
            // Source form deleted or not visible to this user.
            return null;
          }
        }),
      );
      if (cancelled) return;

      const schemas: Record<number, FormSchema> = {};
      for (const entry of schemaEntries) {
        if (entry) {
          schemas[entry[0]] = entry[1];
        }
      }
      setPreviousAnswerSchemas(schemas);

      const dataEntries = await Promise.all(
        sourceFormIds.map(async (formId) => {
          try {
            if (previewId !== null) {
              const response = await tasksGetFormResponsesAdmin({
                path: { id: formId },
              });
              const match = (response.data ?? []).find(
                (candidate) => String(candidate.user?.id) === previewId,
              );
              return match ? ([formId, match.answers ?? {}] as const) : null;
            }
            const response = await tasksGetMyFormResponse({
              path: { id: formId },
            });
            return response.data
              ? ([formId, response.data.answers ?? {}] as const)
              : null;
          } catch {
            // The user has not submitted the source form.
            return null;
          }
        }),
      );
      if (cancelled) return;

      const data: Record<number, Record<string, unknown>> = {};
      for (const entry of dataEntries) {
        if (entry) {
          data[entry[0]] = entry[1];
        }
      }
      setPreviousAnswerData(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceFormIds, previewUserId]);

  return { previousAnswerSchemas, previousAnswerData };
}

/**
 * Runs every validator a `visibleIfFormula` references and caches the verdicts
 * by validator id. A completed response replays its saved verdicts instead, so
 * a read-only form shows the pages the submitter actually saw.
 */
export function useVisibilityValidatorResults(args: {
  schema: FormSchema;
  readOnly: boolean;
  /** The response's raw jsonb blob, validated here rather than by the caller. */
  savedResults?: Record<string, unknown> | null;
}): Record<number, boolean> {
  const { schema, readOnly, savedResults } = args;

  const visibilityValidatorIds = useMemo(() => {
    const ids = new Set<number>();
    forEachCondition(schema, (condition) => {
      if (condition.kind === "validator") {
        ids.add(condition.validatorId);
      }
    });
    return Array.from(ids);
  }, [schema]);

  const [results, setResults] = useState<Record<number, boolean>>({});

  // A response saved before a validator was added has no verdict for it, and a
  // missing verdict reads as hidden, so default to passing.
  const readOnlyResults = useMemo(() => {
    const defaults: Record<number, boolean> = {};
    for (const id of visibilityValidatorIds) {
      defaults[id] = true;
    }
    return {
      ...defaults,
      ...R.unwrapOr(parseVisibilityValidatorResults(savedResults), {}),
    };
  }, [visibilityValidatorIds, savedResults]);

  // Drop verdicts for validators the schema no longer references. Returning
  // `prev` when there are none matters: a fresh object here re-runs the fetch
  // below, which would request every validator a second time on mount.
  useEffect(() => {
    if (readOnly) {
      return;
    }
    setResults((prev) => {
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
    const missingIds = visibilityValidatorIds.filter((id) => !(id in results));
    if (!missingIds.length) {
      return;
    }

    let cancelled = false;
    void (async () => {
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
      setResults((prev) => {
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
  }, [visibilityValidatorIds, results, readOnly]);

  return readOnly ? readOnlyResults : results;
}

export type FormVisibility = {
  visibilityExtras: ConditionExtras;
  effectiveFormData: Record<string, FormValue>;
  variableValues: ReturnType<typeof resolveVariableValues>;
  isElementCurrentlyVisible: (
    element: AnyField | DisplayBlock,
    data?: Record<string, FormValue>,
  ) => boolean;
  isFieldCurrentlyRequired: (
    field: AnyField,
    data?: Record<string, FormValue>,
  ) => boolean;
  visiblePageIndices: number[];
  nextVisiblePageIndex: number | null;
  previousVisiblePageIndex: number | null;
  validateFieldValue: (
    field: AnyField,
    fieldValue: FormValue | undefined,
    data?: Record<string, FormValue>,
  ) => string | null;
};

/**
 * Everything downstream of "which answers count right now". Answers to fields
 * the user cannot currently see are stripped before visibility, validation,
 * rendering and submission read them, so what the user sees is exactly what
 * submits. Raw `formData` keeps the hidden values, so re-showing a field
 * restores what was typed.
 *
 * Also nudges `currentPageIndex` to the nearest visible page when an answer
 * hides the page the user is on, so `setCurrentPageIndex` must be referentially
 * stable. Pass a `useState` setter, or a `useCallback`.
 */
export function useFormVisibility(args: {
  schema: FormSchema;
  formData: Record<string, FormValue>;
  readOnly: boolean;
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
  effectiveDeviceType: DeviceVisibilityTarget;
  visibilityValidatorResults: Record<number, boolean>;
  fieldLookup: Map<string, AnyField>;
  previousAnswerData: ConditionExtras["previousAnswerData"];
  userHasCity: boolean;
  userPropertyHasValue?: UserPropertyPresence;
  firstContractSignedAt: string | null;
  completedActionCount: number;
}): FormVisibility {
  const {
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
    userPropertyHasValue,
    firstContractSignedAt,
    completedActionCount,
  } = args;

  const groupByFieldId = useMemo(
    () => collectGroupByFieldId(schema.pages ?? []),
    [schema.pages],
  );

  // The single source of the account/device/validator state every visibility
  // and requiredness evaluation reads. Built once so a new condition kind is
  // added here rather than at each call site. Miss one and it would silently
  // evaluate against the guest default, since every key is optional.
  const visibilityExtras = useMemo<ConditionExtras>(
    () => ({
      deviceType: effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      userPropertyHasValue: userPropertyHasValue ?? emptyUserPropertyPresence(),
      groupByFieldId,
      firstContractSignedAt,
      completedActionCount,
    }),
    [
      effectiveDeviceType,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      userPropertyHasValue,
      groupByFieldId,
      firstContractSignedAt,
      completedActionCount,
    ],
  );

  // `readOnly` isn't part of `ConditionExtras`. Only the element/page
  // visibility helpers take it, to treat a completed form's fields as visible.
  const visibilityExtrasReadOnly = useMemo(
    () => ({ ...visibilityExtras, readOnly }),
    [visibilityExtras, readOnly],
  );

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

  // Reads the same answers as `validateFieldValue`, so a required marker on the
  // label agrees with what blocks submission and with the server's check.
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

  useEffect(() => {
    const fallback = getFallbackVisiblePageIndex(
      visiblePageIndices,
      currentPageIndex,
    );
    if (fallback !== null) {
      setCurrentPageIndex(fallback);
    }
  }, [visiblePageIndices, currentPageIndex, setCurrentPageIndex]);

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

  return {
    visibilityExtras,
    effectiveFormData,
    variableValues,
    isElementCurrentlyVisible,
    isFieldCurrentlyRequired,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    validateFieldValue,
  };
}

export type PageValidationResult = {
  isValid: boolean;
  firstInvalidFieldId?: string;
};

/**
 * Page and whole-form validation. Fields on a hidden page count as invisible:
 * their errors clear and neither navigation nor submission is blocked.
 */
export function useFormValidation(args: {
  schema: FormSchema;
  readOnly: boolean;
  effectiveFormData: Record<string, FormValue>;
  visibilityExtras: ConditionExtras;
  visiblePageIndices: number[];
  isElementCurrentlyVisible: FormVisibility["isElementCurrentlyVisible"];
  validateFieldValue: FormVisibility["validateFieldValue"];
  applyFieldErrorUpdates: FieldErrorUpdater;
}): {
  validatePage: (
    pageIndex: number,
    includeCustomValidators: boolean,
  ) => Promise<PageValidationResult>;
  validateAllPages: () => Promise<{
    isValid: boolean;
    firstInvalidPageIndex: number | null;
    firstInvalidFieldId?: string;
  }>;
} {
  const {
    schema,
    readOnly,
    effectiveFormData,
    visibilityExtras,
    visiblePageIndices,
    isElementCurrentlyVisible,
    validateFieldValue,
    applyFieldErrorUpdates,
  } = args;

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

            return [
              field.id,
              response.data.isValid ? null : (response.data.message ?? null),
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
    ): Promise<PageValidationResult> => {
      const page = schema.pages[pageIndex];
      if (!page) {
        return { isValid: true };
      }

      const updates: Record<string, string | null> = {};
      const fieldsOnPage = flattenPageItems(page.fields).filter(
        isQuestionField,
      );
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
          Object.assign(
            updates,
            getListSubFieldErrors(
              field,
              fieldValue,
              effectiveFormData,
              visibilityExtras,
            ),
          );
        }
      }

      if (includeCustomValidators && !readOnly) {
        const candidates = visibleFields.filter(
          (field) => field.customValidatorId && !updates[field.id],
        );
        if (candidates.length > 0) {
          Object.assign(
            updates,
            await runCustomValidatorsForFields(candidates),
          );
        }
      }

      // Every list on the page, not just the visible ones: a list the user
      // has since hidden still owns stale `parentId:cardIndex:subId` keys.
      const listFieldIds = fieldsOnPage
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
      // A list sub-field error has no field of its own to scroll to, so fall
      // back to the `parentId` head of its `parentId:cardIndex:subId` key.
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

      return { isValid: !hasAnyError, firstInvalidFieldId };
    },
    [
      schema,
      effectiveFormData,
      isElementCurrentlyVisible,
      visiblePageIndices,
      validateFieldValue,
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

  return { validatePage, validateAllPages };
}
