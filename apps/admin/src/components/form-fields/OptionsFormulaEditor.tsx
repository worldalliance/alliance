import type { OptionsFormula } from "@alliance/common/forms/variables";
import { useMemo } from "react";
import { FormPickerError, FormPickerErrorReason } from "../FormPickerError";
import { FormulaEditor } from "../FormulaEditor";
import { FormulaResult } from "../formulaResult";
import { useFormulaSources } from "../FormulaSourcesContext";
import type { InputSources } from "../VariableInputPickers";

export function OptionsFormulaEditor({
  fieldId,
  formula,
  onChange,
}: {
  /** The choice field the formula gives options to. */
  fieldId: string;
  formula: OptionsFormula;
  onChange: (formula: OptionsFormula) => void;
}) {
  const { sources: formSources, formListFailed } = useFormulaSources();
  // Reading the field itself, or the list holding it, would be a loop.
  const sources = useMemo(
    (): InputSources => ({
      ...formSources,
      fieldsFor: (sourceFormId) =>
        sourceFormId === undefined
          ? formSources
              .fieldsFor(undefined)
              .filter(
                (field) =>
                  field.id !== fieldId &&
                  !(
                    field.kind === "list" &&
                    field.fields.some((sub) => sub.id === fieldId)
                  ),
              )
          : formSources.fieldsFor(sourceFormId),
    }),
    [formSources, fieldId],
  );
  return (
    <>
      {formListFailed && (
        <FormPickerError reason={FormPickerErrorReason.FormList} />
      )}
      <FormulaEditor
        formula={formula}
        result={FormulaResult.Options}
        sources={sources}
        onChange={onChange}
      />
    </>
  );
}
