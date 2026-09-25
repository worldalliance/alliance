/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import type {
  AnyField,
  FormSchema,
  FormValue,
} from "@alliance/common/forms/form-schema";
import {
  collectVariableInputFields,
  readableVariableInputFields,
} from "@alliance/common/forms/form-schema";
import { evaluateVariableText } from "@alliance/common/forms/variable-evaluation";
import {
  compileVariableExpression,
  type ExprValue,
} from "@alliance/common/forms/variable-expression";
import { checkVariableFormulaType } from "@alliance/common/forms/variable-formula-check";
import {
  inputSourceFormId,
  isListInput,
  isSourceInput,
  type VariableFieldInput,
  type VariableInput,
} from "@alliance/common/forms/variable-inputs";
import { collectUnresolvedVariableReferences } from "@alliance/common/forms/variable-interpolation";
import { variableFieldScope } from "@alliance/common/forms/variable-scope";
import {
  sanitizeVariableName,
  syncListInputProperties,
  syncVariableListInputs,
  VARIABLE_NAME_REGEX,
  variableInputNameForIndex,
  variableTypeEnv,
  type FormVariable,
} from "@alliance/common/forms/variables";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { milliseconds } from "date-fns";
import { omit } from "es-toolkit";
import { Check, Copy, Info, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renameKeys } from "../lib/renameKeys";
import { makeTempId } from "../lib/tempId";
import { useVariableSourceForms } from "../lib/useVariableSourceForms";
import { FormPickerError, FormPickerErrorReason } from "./FormPickerError";
import { SharedOutputSourceWarning } from "./SharedOutputSourceWarning";
import { VariableHelpModal, type FormulaHelpInput } from "./VariableHelpModal";
import { type InputSources } from "./VariableInputPickers";
import { VariableInputRow } from "./VariableInputRow";
import {
  inputPad,
  inputText,
  readInputSample,
  readSubmissionSamples,
  type SubmissionSample,
} from "./VariableSamples";
import { answerHelp, inputHelp } from "./variableInputHelp";

function CopyableReference({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reference = `#{${name}}`;

  useEffect(() => () => clearTimeout(resetTimeout.current), []);

  return (
    <button
      type="button"
      title="Copy reference"
      aria-label={`Copy ${reference}`}
      onClick={() => {
        navigator.clipboard.writeText(reference).then(
          () => {
            setCopied(true);
            resetTimeout.current = setTimeout(
              () => setCopied(false),
              milliseconds({ seconds: 2 }),
            );
          },
          () => setCopied(false),
        );
      }}
      className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-100"
    >
      {reference}
      {copied ? (
        <Check size={12} className="text-green-600" />
      ) : (
        <Copy size={12} className="text-gray-400" />
      )}
    </button>
  );
}

const unpickedInput = (sourceFormId: number | undefined): VariableFieldInput =>
  sourceFormId === undefined
    ? { kind: "field", fieldId: "" }
    : { kind: "sourceField", sourceFormId, fieldId: "" };

const inputForField = (
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

const fieldReadBy = (input: VariableInput, eligibleFields: AnyField[]) =>
  eligibleFields.find(
    (candidate) =>
      candidate.id === input.fieldId &&
      (candidate.kind === "list") === isListInput(input),
  );

const exampleFormula = (input: VariableInput): string => {
  switch (input.kind) {
    case "field":
    case "sourceField":
      return "input1";
    case "list":
    case "sourceList":
    case "aggregate":
      return answerHelp(input, undefined).example("input1");
    default:
      throw new Error(`unknown input kind: ${input satisfies never}`);
  }
};

const uniqueVariableName = (existing: FormVariable[]): string => {
  const taken = new Set(existing.map((variable) => variable.name));
  for (let n = existing.length + 1; ; n += 1) {
    const candidate = `variable${n}`;
    if (!taken.has(candidate)) return candidate;
  }
};

type VariableCardProps = {
  variable: FormVariable;
  allVariables: FormVariable[];
  sources: InputSources;
  onChange: (next: FormVariable) => void;
  onRemove: () => void;
};

function VariableCard({
  variable,
  allVariables,
  sources,
  onChange,
  onRemove,
}: VariableCardProps) {
  const [samples, setSamples] = useState<Record<string, FormValue>>({});
  const [submissionSamples, setSubmissionSamples] = useState<
    Record<string, SubmissionSample[]>
  >({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [replacedFormula, setReplacedFormula] = useState<string | null>(null);
  const formulaRef = useRef<HTMLTextAreaElement>(null);
  // Null until the formula box has been used, which is what tells an inserted
  // snippet whether it has somewhere to land.
  const selection = useRef<{ start: number; end: number } | null>(null);

  const inputNames = useMemo(
    () => Object.keys(variable.inputs),
    [variable.inputs],
  );

  const compiled = useMemo(
    () => compileVariableExpression(variable.formula, new Set(inputNames)),
    [variable.formula, inputNames],
  );

  const inputTypes = useMemo(
    () => variableTypeEnv(variable, sources.scope),
    [variable, sources.scope],
  );

  const fieldOf = useCallback(
    (input: VariableInput) =>
      fieldReadBy(input, sources.fieldsFor(inputSourceFormId(input))),
    [sources],
  );

  const typed = useMemo(() => {
    if (!compiled.ok) return compiled;
    return checkVariableFormulaType(variable.formula, inputTypes);
  }, [compiled, variable.formula, inputTypes]);

  const nameError = useMemo(() => {
    if (!VARIABLE_NAME_REGEX.test(variable.name)) {
      return "Name can't be empty.";
    }
    const duplicate = allVariables.filter(
      (other) => other.name === variable.name,
    );
    return duplicate.length > 1
      ? "Another variable already uses this name."
      : null;
  }, [variable.name, allVariables]);

  const readings = useMemo(
    () =>
      new Map(
        inputNames.map((name) => {
          const input = variable.inputs[name];
          const field = fieldOf(input);
          return [
            name,
            isSourceInput(input)
              ? readSubmissionSamples(
                  input,
                  field,
                  submissionSamples[name] ?? [],
                )
              : readInputSample(input, field, samples[name]),
          ] as const;
        }),
      ),
    [inputNames, samples, submissionSamples, fieldOf, variable.inputs],
  );

  const preview = useMemo(() => {
    if (!compiled.ok || !typed.ok) return null;
    const values = new Map<string, ExprValue>(
      [...readings].map(([name, reading]) => [name, reading.value]),
    );
    return evaluateVariableText(compiled.value, values);
  }, [compiled, typed, readings]);

  const formulaError = compiled.ok
    ? typed.ok
      ? preview?.ok === false
        ? preview.error
        : null
      : typed.error
    : compiled.error;

  const helpInputs = useMemo<FormulaHelpInput[]>(
    () =>
      inputNames.map((name) => {
        const input = variable.inputs[name];
        const field = fieldOf(input);
        const example = inputHelp(input, field).example(name);
        return {
          name,
          type: inputTypes.get(name) ?? "any",
          example: field && example !== "" ? example : null,
        };
      }),
    [inputNames, variable.inputs, fieldOf, inputTypes],
  );

  // A formula is a single expression, so a snippet appended to one already
  // written is never valid. Without a caret to insert at, the snippet takes the
  // formula over and the old one stays one click away.
  const insertSnippet = (snippet: string) => {
    const at = selection.current ?? {
      start: 0,
      end: variable.formula.length,
    };
    if (selection.current === null && variable.formula !== "") {
      setReplacedFormula(variable.formula);
    }
    const caret = at.start + snippet.length;
    selection.current = { start: caret, end: caret };
    onChange({
      ...variable,
      formula:
        variable.formula.slice(0, at.start) +
        snippet +
        variable.formula.slice(at.end),
    });
    requestAnimationFrame(() => {
      formulaRef.current?.focus();
      formulaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const setInput = (name: string, next: VariableInput) =>
    onChange({ ...variable, inputs: { ...variable.inputs, [name]: next } });

  const localFields = sources.fieldsFor(undefined);

  // Another form's questions load only once an input reads it, so picking its
  // first question would depend on what else the builder reads. Its input
  // always waits on a pick instead.
  const setInputSource = (name: string, sourceFormId: number | undefined) => {
    const first = sourceFormId === undefined ? localFields[0] : undefined;
    setSamples((prev) => omit(prev, [name]));
    setSubmissionSamples((prev) => omit(prev, [name]));
    setInput(
      name,
      first ? inputForField(first, sourceFormId) : unpickedInput(sourceFormId),
    );
  };

  const canAddInput = localFields.length > 0 || sources.forms.length > 0;

  const addInput = () => {
    const field = localFields[0];
    const name = variableInputNameForIndex(inputNames.length);
    onChange({
      ...variable,
      inputs: {
        ...variable.inputs,
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
      inputs[newName] = variable.inputs[oldName];
      renames.set(oldName, newName);
    });
    const formula = variable.formula.replace(
      /\b(input\d+)\b/g,
      (whole, name: string) => renames.get(name) ?? whole,
    );
    setSamples((prev) => renameKeys(prev, renames));
    setSubmissionSamples((prev) => renameKeys(prev, renames));
    onChange({ ...variable, inputs, formula });
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-gray-500">
            Name
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={variable.name}
              onChange={(event) =>
                onChange({
                  ...variable,
                  name: sanitizeVariableName(event.target.value),
                })
              }
              className={cn(
                inputText,
                "max-w-xs",
                nameError && "border-red-400",
              )}
            />
            <CopyableReference name={variable.name} />
          </div>
          {nameError ? (
            <p className="text-xs text-red-600">{nameError}</p>
          ) : (
            <p className="text-xs text-gray-500">
              Letters, numbers, <span className="font-mono">-</span> and{" "}
              <span className="font-mono">_</span> only.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Delete variable"
          aria-label={`Delete variable ${variable.name}`}
          className="p-1 text-gray-400 hover:text-red-500"
        >
          <X size={16} />
        </button>
      </div>

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
            const input = variable.inputs[name];
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
                onInputChange={(next) => setInput(name, next)}
                onFieldPick={(picked) =>
                  setInput(name, inputForField(picked, sourceFormId))
                }
                onSourceChange={(next) => setInputSource(name, next)}
                onSampleChange={(next) =>
                  setSamples((prev) => ({ ...prev, [name]: next }))
                }
                onSubmissionsChange={(next) =>
                  setSubmissionSamples((prev) => ({ ...prev, [name]: next }))
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
          value={variable.formula}
          onChange={(event) => {
            setReplacedFormula(null);
            onChange({ ...variable, formula: event.target.value });
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
              onChange({ ...variable, formula: replacedFormula });
              setReplacedFormula(null);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Undo, back to <span className="font-mono">{replacedFormula}</span>
          </button>
        )}
        {formulaError === null && typed.ok ? (
          <p className="text-xs text-gray-500">
            Result:{" "}
            <span className="font-mono">
              {(preview?.ok && preview.value) || "—"}
            </span>{" "}
            <span className="text-gray-400">&middot; {typed.value}</span>
          </p>
        ) : (
          <p className="text-xs text-red-600">{formulaError}</p>
        )}
      </div>

      {helpOpen && (
        <VariableHelpModal
          inputs={helpInputs}
          onInsert={(snippet) => {
            insertSnippet(snippet);
            setHelpOpen(false);
          }}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}

interface VariableBuilderProps {
  /** Unset while the form is being created. */
  formId: number | undefined;
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

export function VariableBuilder({
  formId,
  schema,
  onSchemaChange,
}: VariableBuilderProps) {
  const eligibleFields = useMemo(
    () => collectVariableInputFields(schema),
    [schema],
  );
  const {
    options,
    isLoading: optionsLoading,
    isError: optionsError,
  } = useFormOptions();
  const { sourceForms, statusByForm } = useVariableSourceForms(
    schema.variables,
  );
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
  // Shows the names a save would give sub-fields added since the last edit;
  // any edit here stores them.
  const variables = useMemo(
    () => syncVariableListInputs(schema.variables ?? [], scope),
    [schema.variables, scope],
  );

  // Cards hold sample answers in their own state, so a key has to follow its
  // variable when an earlier one is deleted. Names repeat and change as typed.
  const [cardKeys, setCardKeys] = useState(() =>
    variables.map(() => makeTempId()),
  );
  if (cardKeys.length !== variables.length) {
    setCardKeys(variables.map((_, index) => cardKeys[index] ?? makeTempId()));
  }

  const unresolvedReferences = useMemo(
    () => collectUnresolvedVariableReferences(schema),
    [schema],
  );

  const setVariables = (next: FormVariable[]) =>
    onSchemaChange({
      ...schema,
      variables: next.length > 0 ? next : undefined,
    });

  const addVariable = () => {
    const field = eligibleFields[0];
    const input = field && inputForField(field, undefined);
    setVariables([
      ...variables,
      {
        name: uniqueVariableName(variables),
        inputs: input ? { input1: input } : {},
        formula: input ? exampleFormula(input) : "0",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mx-auto w-full max-w-4xl">
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Variables</h2>
            <Button onClick={addVariable} color={ButtonColor.Blue}>
              Add variable
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Compute a value from the answers on this form or the member&apos;s
            answers to other forms, then write it into any text or field label
            as <span className="font-mono">#{"{name}"}</span>.
          </p>
        </div>

        {optionsError && (
          <FormPickerError
            reason={FormPickerErrorReason.FormList}
            className="mb-6"
          />
        )}

        <SharedOutputSourceWarning schema={schema} />

        {unresolvedReferences.length > 0 && (
          <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 space-y-1">
            <p className="text-sm font-medium text-amber-900">
              These references don&apos;t match any variable, and will show as
              written to respondents:
            </p>
            {unresolvedReferences.map(({ name, locations }) => (
              <p key={name} className="text-xs text-amber-800">
                <span className="font-mono">
                  #{"{"}
                  {name}
                  {"}"}
                </span>{" "}
                in {locations.join(", ")}
              </p>
            ))}
          </div>
        )}

        {variables.length === 0 ? (
          <p className="text-sm text-gray-500">
            No variables yet. Add one to reference a computed value in your
            form&apos;s text.
          </p>
        ) : (
          <div className="space-y-4">
            {variables.map((variable, index) => (
              <VariableCard
                key={cardKeys[index]}
                variable={variable}
                allVariables={variables}
                sources={sources}
                onChange={(next) =>
                  setVariables(
                    variables.map((current, i) =>
                      i === index ? next : current,
                    ),
                  )
                }
                onRemove={() => {
                  setCardKeys(cardKeys.filter((_, i) => i !== index));
                  setVariables(variables.filter((_, i) => i !== index));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
