import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type ConditionExtras } from "@alliance/common/forms/visibility";
import { useCallback, useState } from "react";
import { customValidatorRunValidator } from "../client";
import { type FormVisibility } from "../useFormRenderer";
import { getListSubFieldErrors } from "./fieldValidation";

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
            const response = await customValidatorRunValidator({
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
      const fieldsOnPage = page.fields.filter(isQuestionField);
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

      const hasError = (key: string) => !!updates[key]?.trim();
      const invalidKeys = Object.keys(updates).filter(hasError);
      const hasAnyError = invalidKeys.length > 0;
      // A list sub-field error is keyed `parentId:cardIndex:subId`.
      const firstInvalidFieldId = visibleFields.find(
        (field) =>
          hasError(field.id) ||
          invalidKeys.some((key) => key.startsWith(`${field.id}:`)),
      )?.id;

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
