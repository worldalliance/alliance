import type { OptionsFormula } from "@alliance/common/forms/variables";
import { useMemo } from "react";
import { ExpandableEditor } from "../kit/ExpandableEditor";
import { FormPickerError, FormPickerErrorReason } from "../../../../components/FormPickerError";
import { FormulaEditor } from "../formulas/FormulaEditor";
import { FormulaResult } from "../formulas/formulaResult";
import { useFormulaSources } from "../formulas/FormulaSourcesContext";
import type { InputSources } from "../formulas/VariableInputPickers";

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
      <ExpandableEditor
        title="Edit options formula"
        render={() => (
          <FormulaEditor
            formula={formula}
            result={FormulaResult.Options}
            sources={sources}
            onChange={onChange}
          />
        )}
      />
    </>
  );
}
