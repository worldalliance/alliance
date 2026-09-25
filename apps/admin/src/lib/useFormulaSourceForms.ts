import type { FormSchema } from "@alliance/common/forms/form-schema";
import { formulaSourceFormIds } from "@alliance/common/forms/formula-options";
import type { SourceFormFields } from "@alliance/common/forms/variable-scope";
import {
  useFormQuestionFieldsMap,
  type FormFieldsStatus,
} from "@alliance/shared/lib/useFormSchema";
import { useStableIds } from "@alliance/shared/lib/useStableIds";
import { useMemo } from "react";

/**
 * The current question fields of every form these schemas' variables and
 * options formulas read.
 */
export function useFormulaSourceForms(schemas: readonly FormSchema[]): {
  sourceForms: SourceFormFields;
  statusByForm: Record<number, FormFieldsStatus>;
} {
  const ids = useStableIds(formulaSourceFormIds(...schemas));
  const { byForm, statusByForm } = useFormQuestionFieldsMap(ids);
  const sourceForms = useMemo(
    () =>
      new Map(
        Object.entries(byForm).map(([formId, fields]) => [
          Number(formId),
          fields,
        ]),
      ),
    [byForm],
  );
  return { sourceForms, statusByForm };
}
