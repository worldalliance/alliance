import type { FormSchema } from "@alliance/common/forms/form-schema";
import { formulaSourceFormIds } from "@alliance/common/forms/formula-options";
import type { SourceFormFields } from "@alliance/common/forms/variable-scope";
import {
  FormFieldsStatus,
  useFormQuestionFieldsMap,
} from "@alliance/shared/lib/useFormSchema";
import { useStableIds } from "@alliance/shared/lib/useStableIds";
import { useMemo } from "react";
import { formFieldsErrorReason } from "../components/FormPickerError";

/**
 * The current question fields of every form these schemas' variables and
 * options formulas read.
 */
export function useFormulaSourceForms(schemas: readonly FormSchema[]): {
  sourceForms: SourceFormFields;
  statusByForm: Record<number, FormFieldsStatus>;
  retryFailed: () => void;
} {
  const ids = useStableIds(formulaSourceFormIds(...schemas));
  const { byForm, statusByForm, retryFailed } = useFormQuestionFieldsMap(ids);
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
  return { sourceForms, statusByForm, retryFailed };
}

export function useFormulaSourceValidation({
  formId,
  schemas,
}: {
  formId: number | undefined;
  schemas: readonly FormSchema[];
}) {
  const {
    sourceForms,
    statusByForm: sourceFormStatus,
    retryFailed: retrySourceForms,
  } = useFormulaSourceForms(schemas);
  const sourceStatuses = Object.entries(sourceFormStatus);
  const pendingSourceForms = useMemo(
    () =>
      new Set(
        Object.entries(sourceFormStatus)
          .filter(([, status]) => status === FormFieldsStatus.Pending)
          .map(([id]) => Number(id)),
      ),
    [sourceFormStatus],
  );
  const failedSourceForms = sourceStatuses.filter(
    ([, status]) => formFieldsErrorReason(status) !== null,
  ).length;
  const validation = useMemo(
    () => ({ formId, sourceForms, pendingSourceForms }),
    [formId, sourceForms, pendingSourceForms],
  );
  return {
    sourceForms,
    pendingSourceForms,
    failedSourceForms,
    retrySourceForms,
    validation,
  };
}
