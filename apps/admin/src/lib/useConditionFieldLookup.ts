import {
  collectSourceFormIds,
  isQuestionField,
  type FormSchema,
  type Page,
} from "@alliance/common/forms/form-schema";
import { useFormQuestionFieldsMap } from "@alliance/shared/lib/useFormSchema";
import { useStableIds } from "@alliance/shared/lib/useStableIds";
import { useMemo } from "react";
import type { ConditionFieldLookup } from "./visibilitySummary";

/**
 * Finds the questions `page`'s rules read, loading those on other forms, so a
 * summary can name them and their options by label.
 */
export function useConditionFieldLookup(
  schema: FormSchema,
  page: Page,
): ConditionFieldLookup {
  const sourceFormIds = useStableIds(
    collectSourceFormIds({ ...schema, pages: [page] }),
  );
  const { byForm } = useFormQuestionFieldsMap(sourceFormIds);
  const ownFields = useMemo(
    () =>
      new Map(
        schema.pages
          .flatMap((candidate) => candidate.fields)
          .filter(isQuestionField)
          .map((field) => [field.id, field]),
      ),
    [schema.pages],
  );
  return useMemo(
    () => (fieldId, sourceFormId) =>
      sourceFormId === null
        ? ownFields.get(fieldId)
        : byForm[sourceFormId]?.find((field) => field.id === fieldId),
    [byForm, ownFields],
  );
}
