import type { AnyField } from "@alliance/common/forms/form-schema";
import {
  inputSourceFormId,
  isCountInput,
  type VariableInput,
} from "@alliance/common/forms/variable-inputs";
import { useRef, useState } from "react";
import { InspectorGroup } from "../kit/InspectorGroup";
import { AddItemButton, ItemList } from "../kit/ItemList";
import { focusInPlace } from "../kit/revealInPane";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { Field } from "../../../../ui/templates/Form";
import { Textarea } from "../../../../ui/Textarea";
import type { FormulaResult } from "./formulaResult";
import { ResultPreview } from "./FormulaResultPreview";
import {
  inputForField,
  RESULT_FORMULA,
  useFormulaEditor,
  type FormulaParts,
} from "./useFormulaEditor";
import { VariableHelpModal } from "./VariableHelpModal";
import type { InputSources } from "./VariableInputPickers";
import { VariableInputRow } from "./VariableInputRow";

type FormulaEditorProps = {
  formula: FormulaParts;
  result: FormulaResult;
  sources: InputSources;
  onChange: (next: FormulaParts) => void;
};

/**
 * A formula's inputs, the expression written over them and the result it
 * gives for the sample answers. Shared by the Formulas tab and the options
 * formula of a select, so it lays out in any width.
 */
export function FormulaEditor({
  formula,
  result,
  sources,
  onChange,
}: FormulaEditorProps) {
  const editor = useFormulaEditor({ formula, result, sources, onChange });
  const [helpOpen, setHelpOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const {
    inputNames,
    inputTypes,
    typed,
    preview,
    formulaError,
    readings,
    fieldOf,
    canAddInput,
    countedForm,
    replacedFormula,
  } = editor;

  const removeInput = (name: string) => {
    editor.removeInput(name);
    requestAnimationFrame(() =>
      focusInPlace(addRef.current?.querySelector("button")),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <InspectorGroup title="Inputs">
        {inputNames.length > 0 && (
          <ItemList label="Inputs">
            {inputNames.map((name) => {
              const input = formula.inputs[name];
              return (
                <VariableInputRow
                  key={name}
                  name={name}
                  input={input}
                  field={fieldOf(input)}
                  sources={sources}
                  type={inputTypes.get(name)}
                  readingError={readings.get(name)?.error}
                  sample={editor.samples[name]}
                  submissions={editor.submissionSamples[name] ?? []}
                  counts={editor.countSamples[name] ?? {}}
                  countsAvailable={
                    RESULT_FORMULA[result].readsCounts &&
                    countedForm !== undefined
                  }
                  randomAvailable={RESULT_FORMULA[result].readsRandom}
                  onModeChange={(mode) => editor.setInputMode(name, mode)}
                  onInputChange={(next) => editor.setInput(name, next)}
                  onFieldPick={(picked) =>
                    editor.setInput(name, pickedInput(input, picked))
                  }
                  onSourceChange={(next) => editor.setInputSource(name, next)}
                  onSampleChange={(next) => editor.setSample(name, next)}
                  onSubmissionsChange={(next) =>
                    editor.setSubmissions(name, next)
                  }
                  onCountsChange={(next) => editor.setCounts(name, next)}
                  onRemove={() => removeInput(name)}
                />
              );
            })}
          </ItemList>
        )}
        {canAddInput ? (
          <div ref={addRef} className="-ml-2.5 flex items-center gap-3">
            <AddItemButton onClick={editor.addInput}>Add input</AddItemButton>
            {inputNames.length === 0 && (
              <span className="text-fg-muted">No inputs yet.</span>
            )}
          </div>
        ) : (
          <p className="text-fg-muted">
            Add a question field to the form first.
          </p>
        )}
      </InspectorGroup>

      <div className="flex flex-col gap-2">
        <Field label="Formula" error={formulaError}>
          {(control) => (
            <Textarea
              {...control}
              ref={editor.formulaRef}
              value={formula.formula}
              onChange={(event) => {
                editor.setReplacedFormula(null);
                onChange({ ...formula, formula: event.target.value });
              }}
              onSelect={(event) => {
                editor.selection.current = {
                  start: event.currentTarget.selectionStart,
                  end: event.currentTarget.selectionEnd,
                };
              }}
              rows={2}
              spellCheck={false}
              className="font-mono text-xs"
            />
          )}
        </Field>
        <div className="-ml-2.5 flex min-w-0 items-center gap-2">
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            onClick={() => setHelpOpen(true)}
          >
            Formula help
          </Button>
          {replacedFormula !== null && (
            <>
              <Button
                variant={ButtonVariant.Ghost}
                size="small"
                onClick={() => {
                  onChange({ ...formula, formula: replacedFormula });
                  editor.setReplacedFormula(null);
                }}
              >
                Undo replace
              </Button>
              <span className="min-w-0 truncate font-mono text-xs text-fg-muted">
                {replacedFormula}
              </span>
            </>
          )}
        </div>
        {formulaError === null && typed.ok && preview !== null && (
          <ResultPreview preview={preview} type={typed.value} />
        )}
      </div>

      {helpOpen && (
        <VariableHelpModal
          inputs={editor.helpInputs}
          result={result}
          recipes={editor.recipes}
          onInsert={(snippet) => {
            editor.insertSnippet(snippet);
            setHelpOpen(false);
          }}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}

const pickedInput = (input: VariableInput, picked: AnyField): VariableInput =>
  isCountInput(input)
    ? { ...input, fieldId: picked.id }
    : inputForField(picked, inputSourceFormId(input));
