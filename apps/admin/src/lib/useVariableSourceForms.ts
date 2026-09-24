import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { SourceFormFields } from "@alliance/common/forms/variable-scope";
import { variableSourceFormIds } from "@alliance/common/forms/variables";
import {
  useFormQuestionFieldsMap,
  type FormFieldsStatus,
} from "@alliance/shared/lib/useFormSchema";
import { useMemo } from "react";

/** The current question fields of every form these variables read. */
export function useVariableSourceForms(variables: FormSchema["variables"]): {
  sourceForms: SourceFormFields;
  statusByForm: Record<number, FormFieldsStatus>;
} {
  const ids = useMemo(() => variableSourceFormIds(variables), [variables]);
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
