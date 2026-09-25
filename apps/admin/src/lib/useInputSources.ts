import {
  collectVariableInputFields,
  readableVariableInputFields,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { variableFieldScope } from "@alliance/common/forms/variable-scope";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { useMemo } from "react";
import type { FormulaSources } from "../components/FormulaSourcesContext";
import type { InputSources } from "../components/VariableInputPickers";
import { useFormulaSourceForms } from "./useFormulaSourceForms";

export function useInputSources(params: {
  /** Unset while the form is being created. */
  formId: number | undefined;
  schema: FormSchema;
}): FormulaSources {
  const { formId, schema } = params;
  const eligibleFields = useMemo(
    () => collectVariableInputFields(schema),
    [schema],
  );
  const {
    options,
    isLoading: optionsLoading,
    isError: optionsError,
  } = useFormOptions();
  const { sourceForms, statusByForm } = useFormulaSourceForms([schema]);
  const scope = useMemo(
    () => variableFieldScope(schema, sourceForms),
    [schema, sourceForms],
  );
  const sources = useMemo(
    (): InputSources => ({
      fieldsFor: (sourceFormId) =>
        sourceFormId === undefined
          ? eligibleFields
          : readableVariableInputFields(sourceForms.get(sourceFormId) ?? []),
      statusOf: (sourceFormId) => statusByForm[sourceFormId],
      forms: options.filter(({ id }) => id !== formId),
      ownForm: options.find(({ id }) => id === formId),
      formsLoaded: !optionsLoading && !optionsError,
      scope,
    }),
    [
      eligibleFields,
      sourceForms,
      statusByForm,
      options,
      optionsLoading,
      optionsError,
      formId,
      scope,
    ],
  );
  return { sources, formListFailed: optionsError };
}
