import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  MATH_OBJECT_NAME,
  type ExprValue,
} from "@alliance/common/forms/variable-expression";
import { collectUnresolvedVariableReferences } from "@alliance/common/forms/variable-interpolation";
import {
  FIELD_KIND_USABLE_AS_VARIABLE_INPUT,
  formatVariableValue,
  formValueToExprValue,
  sanitizeVariableName,
  VARIABLE_NAME_REGEX,
  variableInputNameForIndex,
  type FormVariable,
  type VariableInput,
} from "@alliance/common/forms/variables";
import { R } from "@alliance/common/result";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Check, Copy, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

// A list's answer is an array of per-row records, so its sub-fields have no
// single value to read and are left out.
const collectEligibleFields = (schema: FormSchema): AnyField[] => {
  const fields: AnyField[] = [];
  for (const page of schema.pages ?? []) {
    for (const element of page.fields ?? []) {
      if (!isQuestionField(element)) continue;
      if (FIELD_KIND_USABLE_AS_VARIABLE_INPUT[element.kind]) {
        fields.push(element);
      }
    }
  }
  return fields;
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
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  const inputNames = useMemo(
    () => Object.keys(variable.inputs),
    [variable.inputs],
  );

  const compiled = useMemo(
    () => compileVariableExpression(variable.formula, new Set(inputNames)),
    [variable.formula, inputNames],
  );

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

  const preview = useMemo(() => {
    if (!compiled.ok) return null;
    // The same coercion a real answer goes through, so the preview cannot
    // disagree with what a respondent will see.
    const values = new Map<string, ExprValue>(
      inputNames.map((name) => [
        name,
        formValueToExprValue(testValues[name] ?? ""),
      ]),
    );
    // Evaluated during render, unlike the live form's, so a formula that throws
    // has to end as an empty preview rather than as a blank screen.
    const value = R.fromThrowable(() =>
      evaluateVariableExpression(compiled.value, values),
    );
    return value.ok ? formatVariableValue(value.value) : "";
  }, [compiled, testValues, inputNames]);

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
              ? "Add a number or range field to the form first."
              : "No inputs yet."}
          </p>
        ) : (
          inputNames.map((name) => {
            const input = variable.inputs[name];
            const missingField = !eligibleFields.some(
              (field) => field.id === input.fieldId,
            );
            return (
              <div key={name} className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-600 w-14 shrink-0">
                  {name}
                </span>
                <select
                  value={input.fieldId}
                  onChange={(event) =>
                    setInput(name, {
                      kind: "field",
                      fieldId: event.target.value,
                    })
                  }
                  className={cn(
                    inputText,
                    "bg-white flex-1",
                    missingField && "border-red-400",
                  )}
                >
                  {/* A deleted field, or one whose kind is no longer usable,
                      matches no option — without this the browser shows the
                      first eligible field as if that were what's stored. */}
                  {missingField && (
                    <option value={input.fieldId}>
                      Missing or unusable field — {input.fieldId}
                    </option>
                  )}
                  {eligibleFields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label || "(no label)"} ({field.kind}) — {field.id}
                    </option>
                  ))}
                </select>
                <input
                  value={testValues[name] ?? ""}
                  onChange={(event) =>
                    setTestValues((prev) => ({
                      ...prev,
                      [name]: event.target.value,
                    }))
                  }
                  placeholder="test"
                  title="Sample value used only for the preview below"
                  className={cn(inputText, "w-20 shrink-0")}
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
            );
          })
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-500">
          Formula
        </label>
        <textarea
          value={variable.formula}
          onChange={(event) =>
            onChange({ ...variable, formula: event.target.value })
          }
          rows={2}
          spellCheck={false}
          className={cn(
            inputPad,
            "font-mono text-sm",
            !compiled.ok && "border-red-400",
          )}
        />
        {compiled.ok ? (
          <p className="text-xs text-gray-500">
            Result: <span className="font-mono">{preview || "—"}</span>
          </p>
        ) : (
          <p className="text-xs text-red-600">{compiled.error}</p>
        )}
      </div>

      <p className="text-xs text-gray-500">
        A formula with no value to show renders as nothing. To show something
        else, say so in the formula:{" "}
        <span className="font-mono">input1 ?? &apos;n/a&apos;</span>.
      </p>
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
  const eligibleFields = useMemo(() => collectEligibleFields(schema), [schema]);

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
          <p className="text-xs text-gray-500">
            A formula is a JavaScript expression:{" "}
            <span className="font-mono">+ - * / % **</span>, comparisons,{" "}
            <span className="font-mono">? :</span>,{" "}
            <span className="font-mono">??</span> for an unanswered field,{" "}
            <span className="font-mono">+</span> to join text, and{" "}
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              any {MATH_OBJECT_NAME} function
            </a>
            , as in <span className="font-mono">Math.round(input1 / 3)</span>.
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
