import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { evaluateOptionsExpression } from "@alliance/common/forms/formula-options";
import { evaluateVariableText } from "@alliance/common/forms/variable-evaluation";
import {
  compileVariableExpression,
  type ExprNode,
  type ExprValue,
} from "@alliance/common/forms/variable-expression";
import {
  checkOptionsFormulaType,
  checkVariableFormulaType,
} from "@alliance/common/forms/variable-formula-check";
import {
  inputSourceFormId,
  isListInput,
  isSourceInput,
  type VariableFieldInput,
  type VariableInput,
} from "@alliance/common/forms/variable-inputs";
import {
  syncListInputProperties,
  variableInputNameForIndex,
  variableTypeEnv,
  type Formula,
} from "@alliance/common/forms/variables";
import { cn } from "@alliance/shared/styles/util";
import { omit } from "es-toolkit";
import { Info, Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { renameKeys } from "../lib/renameKeys";
import { readCountSample, type CountSample } from "./CountSamples";
import { FormulaResult } from "./formulaResult";
import { ResultPreview, type Preview } from "./FormulaResultPreview";
import { VariableHelpModal, type FormulaHelpInput } from "./VariableHelpModal";
import { inputHelp, optionsRecipes } from "./variableInputHelp";
import {
  fieldChoices,
  InputMode,
  type InputSources,
} from "./VariableInputPickers";
import { VariableInputRow } from "./VariableInputRow";
import {
  inputPad,
  readInputSample,
  readSubmissionSamples,
  type SubmissionSample,
} from "./VariableSamples";

type FormulaParts = Pick<Formula, "inputs" | "formula">;

const unpickedInput = (sourceFormId: number | undefined): VariableFieldInput =>
  sourceFormId === undefined
    ? { kind: "field", fieldId: "" }
    : { kind: "sourceField", sourceFormId, fieldId: "" };

export const inputForField = (
  field: AnyField,
  sourceFormId: number | undefined,
): VariableInput => {
  if (field.kind !== "list") {
    return { ...unpickedInput(sourceFormId), fieldId: field.id };
  }
  const properties = syncListInputProperties({}, field.fields);
  return sourceFormId === undefined
    ? { kind: "list", fieldId: field.id, properties }
    : { kind: "sourceList", sourceFormId, fieldId: field.id, properties };
};

const RESULT_FORMULA: Record<
  FormulaResult,
  {
    typeCheck: typeof checkVariableFormulaType;
    preview: (
      node: ExprNode,
      values: ReadonlyMap<string, ExprValue>,
    ) => Preview;
    /** The input examples all give text, so they show only without recipes. */
    offersRecipes: boolean;
    /** Nothing loads member counts for an options formula. */
    readsCounts: boolean;
  }
> = {
  [FormulaResult.Text]: {
    typeCheck: checkVariableFormulaType,
    preview: (node, values) => ({
      result: FormulaResult.Text,
      value: evaluateVariableText(node, values),
    }),
    offersRecipes: false,
    readsCounts: true,
  },
  [FormulaResult.Options]: {
    typeCheck: checkOptionsFormulaType,
    preview: (node, values) => ({
      result: FormulaResult.Options,
      value: evaluateOptionsExpression(node, values),
    }),
    offersRecipes: true,
    readsCounts: false,
  },
};

const fieldReadBy = (input: VariableInput, sources: InputSources) =>
  fieldChoices(input, sources).find(
    (candidate) =>
      candidate.id === input.fieldId &&
      (candidate.kind === "list") === isListInput(input),
  );

type FormulaEditorProps = {
  formula: FormulaParts;
  result: FormulaResult;
  sources: InputSources;
  onChange: (next: FormulaParts) => void;
};

export function FormulaEditor({
  formula,
  result,
  sources,
  onChange,
}: FormulaEditorProps) {
  const [samples, setSamples] = useState<Record<string, FormValue>>({});
  const [submissionSamples, setSubmissionSamples] = useState<
    Record<string, SubmissionSample[]>
  >({});
  const [countSamples, setCountSamples] = useState<Record<string, CountSample>>(
    {},
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [replacedFormula, setReplacedFormula] = useState<string | null>(null);
  const formulaRef = useRef<HTMLTextAreaElement>(null);
  // Null until the formula box has been used, which is what tells an inserted
  // snippet whether it has somewhere to land.
  const selection = useRef<{ start: number; end: number } | null>(null);

  const inputNames = useMemo(
    () => Object.keys(formula.inputs),
    [formula.inputs],
  );

  const compiled = useMemo(
    () => compileVariableExpression(formula.formula, new Set(inputNames)),
    [formula.formula, inputNames],
  );

  const inputTypes = useMemo(
    () => variableTypeEnv(formula, sources.scope),
    [formula, sources.scope],
  );

  const fieldOf = useCallback(
    (input: VariableInput) => fieldReadBy(input, sources),
    [sources],
  );

  const typed = useMemo(() => {
    if (!compiled.ok) return compiled;
    return RESULT_FORMULA[result].typeCheck(formula.formula, inputTypes);
  }, [compiled, formula.formula, inputTypes, result]);

  const readings = useMemo(
    () =>
      new Map(
        inputNames.map((name) => {
          const input = formula.inputs[name];
          const field = fieldOf(input);
          const reading =
            input.kind === "aggregate"
              ? readCountSample(field, countSamples[name] ?? {})
              : isSourceInput(input)
                ? readSubmissionSamples(
                    input,
                    field,
                    submissionSamples[name] ?? [],
                  )
                : readInputSample(input, field, samples[name]);
          return [name, reading] as const;
        }),
      ),
    [
      inputNames,
      samples,
      submissionSamples,
      countSamples,
      fieldOf,
      formula.inputs,
    ],
  );

  const preview = useMemo((): Preview | null => {
    if (!compiled.ok || !typed.ok) return null;
    const values = new Map<string, ExprValue>(
      [...readings].map(([name, reading]) => [name, reading.value]),
    );
    return RESULT_FORMULA[result].preview(compiled.value, values);
  }, [compiled, typed, readings, result]);

  const formulaError = compiled.ok
    ? typed.ok
      ? preview?.value.ok === false
        ? preview.value.error
        : null
      : typed.error
    : compiled.error;

  const helpInputs = useMemo<FormulaHelpInput[]>(
    () =>
      inputNames.map((name) => {
        const input = formula.inputs[name];
        const field = fieldOf(input);
        const example = inputHelp(input, field).example(name);
        return {
          name,
          type: inputTypes.get(name) ?? "any",
          example:
            !RESULT_FORMULA[result].offersRecipes && field && example !== ""
              ? example
              : null,
        };
      }),
    [inputNames, formula.inputs, fieldOf, inputTypes, result],
  );

  const recipes = useMemo(
    () =>
      RESULT_FORMULA[result].offersRecipes
        ? optionsRecipes(
            inputNames.map((name) => {
              const input = formula.inputs[name];
              return { name, input, field: fieldOf(input) };
            }),
          )
        : [],
    [result, inputNames, formula.inputs, fieldOf],
  );

  // A formula is a single expression, so a snippet appended to one already
  // written is never valid. Without a caret to insert at, the snippet takes the
  // formula over and the old one stays one click away.
  const insertSnippet = (snippet: string) => {
    const at = selection.current ?? {
      start: 0,
      end: formula.formula.length,
    };
    if (selection.current === null && formula.formula !== "") {
      setReplacedFormula(formula.formula);
    }
    const caret = at.start + snippet.length;
    selection.current = { start: caret, end: caret };
    onChange({
      ...formula,
      formula:
        formula.formula.slice(0, at.start) +
        snippet +
        formula.formula.slice(at.end),
    });
    requestAnimationFrame(() => {
      formulaRef.current?.focus();
      formulaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const setInput = (name: string, next: VariableInput) =>
    onChange({ ...formula, inputs: { ...formula.inputs, [name]: next } });

  const localFields = sources.fieldsFor(undefined);

  const clearSamples = (name: string) => {
    setSamples((prev) => omit(prev, [name]));
    setSubmissionSamples((prev) => omit(prev, [name]));
    setCountSamples((prev) => omit(prev, [name]));
  };

  // Another form's questions load only once an input reads it, so picking its
  // first question would depend on what else the builder reads. Its input
  // always waits on a pick instead.
  const setInputSource = (name: string, sourceFormId: number | undefined) => {
    clearSamples(name);
    if (
      formula.inputs[name].kind === "aggregate" &&
      sourceFormId !== undefined
    ) {
      setInput(name, { kind: "aggregate", sourceFormId, fieldId: "" });
      return;
    }
    const first = sourceFormId === undefined ? localFields[0] : undefined;
    setInput(
      name,
      first ? inputForField(first, sourceFormId) : unpickedInput(sourceFormId),
    );
  };

  const countedForm = sources.ownForm ?? sources.forms[0];

  const setInputMode = (name: string, mode: InputMode) => {
    const current = formula.inputs[name];
    const sourceFormId = inputSourceFormId(current) ?? countedForm?.id;
    switch (mode) {
      case InputMode.Answers:
        if (current.kind === "aggregate") setInputSource(name, undefined);
        return;
      case InputMode.Counts:
        if (current.kind === "aggregate" || sourceFormId === undefined) return;
        clearSamples(name);
        setInput(name, { kind: "aggregate", sourceFormId, fieldId: "" });
        return;
      default:
        throw new Error(`unknown input mode: ${mode satisfies never}`);
    }
  };

  const canAddInput = localFields.length > 0 || sources.forms.length > 0;

  const addInput = () => {
    const field = localFields[0];
    const name = variableInputNameForIndex(inputNames.length);
    onChange({
      ...formula,
      inputs: {
        ...formula.inputs,
        [name]: field
          ? inputForField(field, undefined)
          : unpickedInput(undefined),
      },
    });
  };

  // Inputs are renumbered so the names stay input1..inputN, and the formula is
  // rewritten to match — otherwise removing input1 would silently break it.
  const removeInput = (removed: string) => {
    const remaining = inputNames.filter((name) => name !== removed);
    const inputs: Record<string, VariableInput> = {};
    const renames = new Map<string, string>();
    remaining.forEach((oldName, index) => {
      const newName = variableInputNameForIndex(index);
      inputs[newName] = formula.inputs[oldName];
      renames.set(oldName, newName);
    });
    const rewritten = formula.formula.replace(
      /\b(input\d+)\b/g,
      (whole, name: string) => renames.get(name) ?? whole,
    );
    setSamples((prev) => renameKeys(prev, renames));
    setSubmissionSamples((prev) => renameKeys(prev, renames));
    setCountSamples((prev) => renameKeys(prev, renames));
    onChange({ ...formula, inputs, formula: rewritten });
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">Inputs</p>
          <button
            type="button"
            onClick={addInput}
            disabled={!canAddInput}
            title="Add input"
            aria-label="Add input"
            className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
        {inputNames.length === 0 ? (
          <p className="text-xs text-gray-500">
            {!canAddInput
              ? "Add a question field to the form first."
              : "No inputs yet."}
          </p>
        ) : (
          inputNames.map((name) => {
            const input = formula.inputs[name];
            const sourceFormId = inputSourceFormId(input);
            return (
              <VariableInputRow
                key={name}
                name={name}
                input={input}
                field={fieldOf(input)}
                sources={sources}
                type={inputTypes.get(name)}
                readingError={readings.get(name)?.error}
                sample={samples[name]}
                submissions={submissionSamples[name] ?? []}
                counts={countSamples[name] ?? {}}
                countsAvailable={
                  RESULT_FORMULA[result].readsCounts &&
                  countedForm !== undefined
                }
                onModeChange={(mode) => setInputMode(name, mode)}
                onInputChange={(next) => setInput(name, next)}
                onFieldPick={(picked) =>
                  setInput(
                    name,
                    input.kind === "aggregate"
                      ? { ...input, fieldId: picked.id }
                      : inputForField(picked, sourceFormId),
                  )
                }
                onSourceChange={(next) => setInputSource(name, next)}
                onSampleChange={(next) =>
                  setSamples((prev) => ({ ...prev, [name]: next }))
                }
                onSubmissionsChange={(next) =>
                  setSubmissionSamples((prev) => ({ ...prev, [name]: next }))
                }
                onCountsChange={(next) =>
                  setCountSamples((prev) => ({ ...prev, [name]: next }))
                }
                onRemove={() => removeInput(name)}
              />
            );
          })
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <label className="block text-xs font-medium text-gray-500">
            Formula
          </label>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            title="What you can write here"
            aria-label="What you can write here"
            className="text-gray-400 hover:text-gray-600"
          >
            <Info size={13} />
          </button>
        </div>
        <textarea
          ref={formulaRef}
          value={formula.formula}
          onChange={(event) => {
            setReplacedFormula(null);
            onChange({ ...formula, formula: event.target.value });
          }}
          onSelect={(event) => {
            selection.current = {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
          }}
          rows={2}
          spellCheck={false}
          className={cn(
            inputPad,
            "font-mono text-sm",
            formulaError !== null && "border-red-400",
          )}
        />
        {replacedFormula !== null && (
          <button
            type="button"
            onClick={() => {
              onChange({ ...formula, formula: replacedFormula });
              setReplacedFormula(null);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Undo, back to <span className="font-mono">{replacedFormula}</span>
          </button>
        )}
        {formulaError === null && typed.ok && preview !== null ? (
          <ResultPreview preview={preview} type={typed.value} />
        ) : (
          <p className="text-xs text-red-600">{formulaError}</p>
        )}
      </div>

      {helpOpen && (
        <VariableHelpModal
          inputs={helpInputs}
          result={result}
          recipes={recipes}
          onInsert={(snippet) => {
            insertSnippet(snippet);
            setHelpOpen(false);
          }}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}
