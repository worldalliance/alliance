import type {
  AnyField,
  FormSchema,
  FormValue,
} from "@alliance/common/forms/form-schema";
import {
  collectVariableInputFields,
  fieldHasOptions,
  variableInputFieldsById,
} from "@alliance/common/forms/form-schema";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  type ExprValue,
} from "@alliance/common/forms/variable-expression";
import { checkVariableFormulaType } from "@alliance/common/forms/variable-formula-check";
import { collectUnresolvedVariableReferences } from "@alliance/common/forms/variable-interpolation";
import {
  FIELD_KIND_VARIABLE_INPUT_MODE,
  formatVariableValue,
  formValueToExprValue,
  sanitizeVariableName,
  VARIABLE_NAME_REGEX,
  VariableInputMode,
  variableInputNameForIndex,
  variableTypeEnv,
  type FormVariable,
  type VariableInput,
} from "@alliance/common/forms/variables";
import { R } from "@alliance/common/result";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Check, Copy, Info, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  INPUT_MODE_HELP,
  inputModeType,
  VariableHelpModal,
  type FormulaHelpInput,
} from "./VariableHelpModal";

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
            resetTimeout.current = setTimeout(() => setCopied(false), 2000);
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

const inputBase =
  "w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
const inputText = cn(inputBase, "px-3 py-1.5");
const inputPad = cn(inputBase, "px-3 py-2");

const SAMPLE_PLACEHOLDER: Record<VariableInputMode, string> = {
  [VariableInputMode.Number]: "sample",
  [VariableInputMode.Text]: "sample",
  [VariableInputMode.City]: "city name",
  [VariableInputMode.Boolean]: "",
  [VariableInputMode.Choice]: "",
  [VariableInputMode.Choices]: "",
  [VariableInputMode.None]: "sample",
};

const inputModeOf = (field: AnyField | undefined) =>
  field ? FIELD_KIND_VARIABLE_INPUT_MODE[field.kind] : VariableInputMode.None;

const fieldOptions = (field: AnyField | undefined) =>
  field && fieldHasOptions(field) ? field.options : [];

// A formula compares against .value, so the sample dropdown has to show it
// rather than only the wording the respondent sees.
const optionText = (option: { label: string; value: string }) =>
  option.label && option.label !== option.value
    ? `${option.value} (${option.label})`
    : option.value;

const sampleChoices = (value: FormValue | undefined): string[] =>
  Array.isArray(value)
    ? [...value].flatMap((item) => (typeof item === "string" ? [item] : []))
    : [];

const isBlankSample = (value: FormValue | undefined) =>
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const readSampleAnswer = (
  field: AnyField | undefined,
  sample: FormValue | undefined,
): { value: ExprValue; error?: string } => {
  if (!field || isBlankSample(sample)) return { value: undefined };

  const mode = FIELD_KIND_VARIABLE_INPUT_MODE[field.kind];
  if (mode === VariableInputMode.Number && typeof sample === "string") {
    if (!Number.isFinite(Number(sample.trim()))) {
      return { value: undefined, error: `"${sample}" is not a number.` };
    }
  }
  if (mode === VariableInputMode.City && typeof sample === "string") {
    // A real answer is the record the city picker stores, not the name typed.
    return {
      value: formValueToExprValue(
        {
          id: 0,
          name: sample.trim(),
          admin1: "",
          countryCode: "",
          countryName: "",
        },
        field,
      ),
    };
  }
  return { value: formValueToExprValue(sample, field) };
};

type SampleAnswerProps = {
  inputName: string;
  field: AnyField | undefined;
  value: FormValue | undefined;
  error: string | undefined;
  onChange: (next: FormValue) => void;
};

function SampleAnswer({
  inputName,
  field,
  value,
  error,
  onChange,
}: SampleAnswerProps) {
  const mode = inputModeOf(field);
  const wide =
    mode === VariableInputMode.Choice || mode === VariableInputMode.Choices;
  const className = cn(
    inputText,
    "shrink-0",
    wide ? "w-48" : "w-32",
    error && "border-red-400",
  );
  const shared = {
    className,
    title: error ?? "Sample answer used only for the preview below",
    "aria-label": `Sample answer for ${inputName}`,
  };
  const options = fieldOptions(field);

  switch (mode) {
    case VariableInputMode.Choice:
      return (
        <select
          {...shared}
          className={cn(className, "bg-white")}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">unanswered</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {optionText(option)}
            </option>
          ))}
        </select>
      );

    case VariableInputMode.Choices:
      return (
        <select
          {...shared}
          multiple
          size={Math.min(Math.max(options.length, 2), 3)}
          className={cn(className, "bg-white py-1")}
          value={sampleChoices(value)}
          onChange={(event) =>
            onChange(
              Array.from(
                event.target.selectedOptions,
                (option) => option.value,
              ),
            )
          }
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {optionText(option)}
            </option>
          ))}
        </select>
      );

    case VariableInputMode.Boolean:
      return (
        <select
          {...shared}
          className={cn(className, "bg-white")}
          value={typeof value === "boolean" ? String(value) : ""}
          onChange={(event) =>
            onChange(event.target.value ? event.target.value === "true" : "")
          }
        >
          <option value="">unanswered</option>
          <option value="true">Ticked</option>
          <option value="false">Not ticked</option>
        </select>
      );

    case VariableInputMode.Number:
    case VariableInputMode.Text:
    case VariableInputMode.City:
    case VariableInputMode.None:
      return (
        <input
          {...shared}
          value={typeof value === "string" ? value : ""}
          disabled={!field}
          placeholder={SAMPLE_PLACEHOLDER[mode]}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    default:
      throw new Error(`unknown input mode: ${mode satisfies never}`);
  }
}

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
  eligibleFields: AnyField[];
  onChange: (next: FormVariable) => void;
  onRemove: () => void;
};

function VariableCard({
  variable,
  allVariables,
  eligibleFields,
  onChange,
  onRemove,
}: VariableCardProps) {
  const [samples, setSamples] = useState<Record<string, FormValue>>({});
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

  const typed = useMemo(() => {
    if (!compiled.ok) return compiled;
    return checkVariableFormulaType(
      variable.formula,
      variableTypeEnv(variable, variableInputFieldsById(eligibleFields)),
    );
  }, [compiled, variable, eligibleFields]);

  const formulaError = compiled.ok
    ? typed.ok
      ? null
      : typed.error
    : compiled.error;

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
          const field = eligibleFields.find(
            (candidate) => candidate.id === variable.inputs[name].fieldId,
          );
          return [name, readSampleAnswer(field, samples[name])] as const;
        }),
      ),
    [inputNames, samples, eligibleFields, variable.inputs],
  );

  const preview = useMemo(() => {
    if (!compiled.ok || !typed.ok) return null;
    const values = new Map<string, ExprValue>(
      [...readings].map(([name, reading]) => [name, reading.value]),
    );
    // Evaluated during render, unlike the live form's, so a formula that throws
    // has to end as an empty preview rather than as a blank screen.
    const value = R.fromThrowable(() =>
      evaluateVariableExpression(compiled.value, values),
    );
    return value.ok ? formatVariableValue(value.value) : "";
  }, [compiled, typed, readings]);

  const helpInputs = useMemo<FormulaHelpInput[]>(
    () =>
      inputNames.map((name) => {
        const field = eligibleFields.find(
          (candidate) => candidate.id === variable.inputs[name].fieldId,
        );
        const mode = inputModeOf(field);
        const example = INPUT_MODE_HELP[mode].example(name);
        return {
          name,
          type: field ? inputModeType(mode) : "any",
          example: field && example !== "" ? example : null,
        };
      }),
    [inputNames, variable.inputs, eligibleFields],
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

  const addInput = () => {
    const field = eligibleFields[0];
    if (!field) return;
    const name = variableInputNameForIndex(inputNames.length);
    onChange({
      ...variable,
      inputs: {
        ...variable.inputs,
        [name]: { kind: "field", fieldId: field.id },
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
            disabled={eligibleFields.length === 0}
            title="Add input"
            aria-label="Add input"
            className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
        {inputNames.length === 0 ? (
          <p className="text-xs text-gray-500">
            {eligibleFields.length === 0
              ? "Add a question field to the form first."
              : "No inputs yet."}
          </p>
        ) : (
          inputNames.map((name) => {
            const input = variable.inputs[name];
            const field = eligibleFields.find(
              (candidate) => candidate.id === input.fieldId,
            );
            const mode = inputModeOf(field);
            const help = INPUT_MODE_HELP[mode];
            const reading = readings.get(name);
            return (
              <div key={name} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-xs text-gray-600">
                    {name}
                  </span>
                  <select
                    value={input.fieldId}
                    aria-label={`Field read by ${name}`}
                    onChange={(event) =>
                      setInput(name, {
                        kind: "field",
                        fieldId: event.target.value,
                      })
                    }
                    className={cn(
                      inputText,
                      "bg-white flex-1",
                      !field && "border-red-400",
                    )}
                  >
                    {/* Keep an explicit option for deleted or unusable fields.
                        Otherwise the browser displays the first eligible field. */}
                    {!field && (
                      <option value={input.fieldId}>
                        Missing or unusable field — {input.fieldId}
                      </option>
                    )}
                    {eligibleFields.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label || "(no label)"} ({candidate.kind}) —{" "}
                        {candidate.id}
                      </option>
                    ))}
                  </select>
                  <SampleAnswer
                    inputName={name}
                    field={field}
                    value={samples[name]}
                    error={reading?.error}
                    onChange={(next) =>
                      setSamples((prev) => ({ ...prev, [name]: next }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeInput(name)}
                    title="Remove input"
                    aria-label={`Remove ${name}`}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
                {field && (
                  <p
                    className="pl-16 font-mono text-[10px] text-gray-500"
                    title={help.notes}
                  >
                    {name}: {inputModeType(mode)}
                  </p>
                )}
                {reading?.error && (
                  <p className="pl-16 text-[10px] text-red-500">
                    {reading.error} Reads as undefined.
                  </p>
                )}
              </div>
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
            Result: <span className="font-mono">{preview || "—"}</span>{" "}
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
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

export function VariableBuilder({
  schema,
  onSchemaChange,
}: VariableBuilderProps) {
  const variables = useMemo(() => schema.variables ?? [], [schema.variables]);
  const eligibleFields = useMemo(
    () => collectVariableInputFields(schema),
    [schema],
  );

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
    setVariables([
      ...variables,
      {
        name: uniqueVariableName(variables),
        inputs: field ? { input1: { kind: "field", fieldId: field.id } } : {},
        formula: field ? "input1" : "0",
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
            Compute a value from the answers on this form, then write it into
            any text or field label as{" "}
            <span className="font-mono">#{"{name}"}</span>.
          </p>
        </div>

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
                key={index}
                variable={variable}
                allVariables={variables}
                eligibleFields={eligibleFields}
                onChange={(next) =>
                  setVariables(
                    variables.map((current, i) =>
                      i === index ? next : current,
                    ),
                  )
                }
                onRemove={() =>
                  setVariables(variables.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
