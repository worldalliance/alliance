import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { VariableInput } from "@alliance/common/forms/variable-inputs";
import { collectUnresolvedVariableReferences } from "@alliance/common/forms/variable-interpolation";
import {
  sanitizeVariableName,
  syncFormulaListInputs,
  VARIABLE_NAME_REGEX,
  type FormVariable,
} from "@alliance/common/forms/variables";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { milliseconds } from "date-fns";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { makeTempId } from "../lib/tempId";
import { FormPickerError, FormPickerErrorReason } from "./FormPickerError";
import { FormulaEditor, inputForField } from "./FormulaEditor";
import { FormulaResult } from "./formulaResult";
import { useFormulaSources } from "./FormulaSourcesContext";
import { SharedOutputSourceWarning } from "./SharedOutputSourceWarning";
import { answerHelp } from "./variableInputHelp";
import { type InputSources } from "./VariableInputPickers";
import { inputText } from "./VariableSamples";

function CopyableReference({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const { error: pushError } = useToast();
  const resetTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reference = `#{${name}}`;

  useEffect(() => () => clearTimeout(resetTimeout.current), []);

  return (
    <button
      type="button"
      title="Copy reference"
      aria-label={`Copy ${reference}`}
      onClick={() => {
        void copyToClipboard(reference).then((ok) => {
          setCopied(ok);
          if (ok) {
            resetTimeout.current = setTimeout(
              () => setCopied(false),
              milliseconds({ seconds: 2 }),
            );
          } else {
            pushError("Could not copy the reference to the clipboard");
          }
        });
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

      <FormulaEditor
        formula={variable}
        result={FormulaResult.Text}
        sources={sources}
        onChange={(next) => onChange({ ...variable, ...next })}
      />
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
  const { sources, formListFailed } = useFormulaSources();
  // Shows the names a save would give sub-fields added since the last edit;
  // any edit here stores them.
  const variables = useMemo(
    () =>
      (schema.variables ?? []).map((variable) =>
        syncFormulaListInputs(variable, sources.scope),
      ),
    [schema.variables, sources.scope],
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
    const field = sources.fieldsFor(undefined)[0];
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
            Compute a value from the answers on this form, the member&apos;s
            answers to other forms, or how many members chose each option of a
            form&apos;s question, then write it into any text or field label as{" "}
            <span className="font-mono">#{"{name}"}</span>.
          </p>
        </div>

        {formListFailed && (
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
