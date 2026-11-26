import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { VariableInput } from "@alliance/common/forms/variable-inputs";
import { collectUnresolvedVariableReferences } from "@alliance/common/forms/variable-interpolation";
import {
  sanitizeVariableName,
  syncFormulaListInputs,
  VARIABLE_NAME_REGEX,
  type FormVariable,
} from "@alliance/common/forms/variables";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { milliseconds } from "date-fns";
import { Check, Copy, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { makeTempId } from "../lib/tempId";
import Button, { ButtonVariant } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import InlineError from "../ui/InlineError";
import { Input } from "../ui/Input";
import { Banner, BannerTone } from "../ui/templates/Banner";
import { Field, FormSection } from "../ui/templates/Form";
import { FormPickerError, FormPickerErrorReason } from "./FormPickerError";
import { FormulaEditor } from "./FormulaEditor";
import { FormulaResult } from "./formulaResult";
import { useFormulaSources } from "./FormulaSourcesContext";
import { SharedOutputSourceWarning } from "./SharedOutputSourceWarning";
import { inputForField } from "./useFormulaEditor";
import { answerHelp } from "./variableInputHelp";
import { type InputSources } from "./VariableInputPickers";

const COPY_FAILED = "Could not copy the reference to the clipboard";

function CopyReference({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reference = `#{${name}}`;

  useEffect(() => () => clearTimeout(resetTimeout.current), []);

  return (
    <>
      <Button
        variant={ButtonVariant.Default}
        size="small"
        aria-label={`Copy ${reference}`}
        onClick={() => {
          void copyToClipboard(reference).then((ok) => {
            setCopied(ok);
            setFailed(!ok);
            if (ok) {
              resetTimeout.current = setTimeout(
                () => setCopied(false),
                milliseconds({ seconds: 2 }),
              );
            }
          });
        }}
      >
        <span className="font-mono text-xs">{reference}</span>
        {copied ? (
          <Check aria-hidden="true" className="size-4 text-success" />
        ) : (
          <Copy aria-hidden="true" className="size-4 text-fg-muted" />
        )}
      </Button>
      {failed && <InlineError message={COPY_FAILED} />}
    </>
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
    case "answeredCount":
    case "random":
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

type FormulaSectionProps = {
  variable: FormVariable;
  allVariables: FormVariable[];
  sources: InputSources;
  onChange: (next: FormVariable) => void;
  onRemove: () => void;
};

function FormulaSection({
  variable,
  allVariables,
  sources,
  onChange,
  onRemove,
}: FormulaSectionProps) {
  const nameError = useMemo(() => {
    if (!VARIABLE_NAME_REGEX.test(variable.name)) {
      return "Name can't be empty.";
    }
    const duplicate = allVariables.filter(
      (other) => other.name === variable.name,
    );
    return duplicate.length > 1
      ? "Another formula already uses this name."
      : null;
  }, [variable.name, allVariables]);

  return (
    <FormSection title={variable.name || "Unnamed formula"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Field
          label="Name"
          help={
            <>
              Letters, numbers, <span className="font-mono">-</span> and{" "}
              <span className="font-mono">_</span> only.
            </>
          }
          error={nameError}
          className="w-full max-w-xs"
        >
          {(control) => (
            <Input
              {...control}
              value={variable.name}
              onChange={(event) =>
                onChange({
                  ...variable,
                  name: sanitizeVariableName(event.target.value),
                })
              }
            />
          )}
        </Field>
        <div className="flex items-center gap-2">
          <CopyReference name={variable.name} />
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            aria-label={`Delete formula ${variable.name}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </Button>
        </div>
      </div>
      <FormulaEditor
        formula={variable}
        result={FormulaResult.Text}
        sources={sources}
        onChange={(next) => onChange({ ...variable, ...next })}
      />
    </FormSection>
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
  const { refetch: refetchForms } = useFormOptions();
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
    <div className="mx-auto flex w-full max-w-240 flex-col gap-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-prose text-fg-muted">
          Compute a value from the answers on this form, the member&apos;s
          answers to other forms, or how many members chose each option of a
          form&apos;s question, then write it into any text or field label as{" "}
          <span className="font-mono">#{"{name}"}</span>.
        </p>
        <Button variant={ButtonVariant.Primary} onClick={addVariable}>
          Add formula
        </Button>
      </div>

      {formListFailed && (
        <Banner
          tone={BannerTone.Warning}
          inline
          action={
            <Button
              variant={ButtonVariant.Ghost}
              size="small"
              onClick={refetchForms}
            >
              Try again
            </Button>
          }
        >
          <FormPickerError reason={FormPickerErrorReason.FormList} />
        </Banner>
      )}

      <SharedOutputSourceWarning schema={schema} />

      {unresolvedReferences.length > 0 && (
        <Banner tone={BannerTone.Warning} inline>
          <p className="font-medium">
            These references don&apos;t match any formula, and will show as
            written to respondents:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {unresolvedReferences.map(({ name, locations }) => (
              <li key={name}>
                <span className="font-mono text-xs">
                  #{"{"}
                  {name}
                  {"}"}
                </span>{" "}
                in {locations.join(", ")}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      {variables.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            title="No formulas yet"
            description="Add one to reference a computed value in your form's text."
          />
        </div>
      ) : (
        variables.map((variable, index) => (
          <FormulaSection
            key={cardKeys[index]}
            variable={variable}
            allVariables={variables}
            sources={sources}
            onChange={(next) =>
              setVariables(
                variables.map((current, i) => (i === index ? next : current)),
              )
            }
            onRemove={() => {
              setCardKeys(cardKeys.filter((_, i) => i !== index));
              setVariables(variables.filter((_, i) => i !== index));
            }}
          />
        ))
      )}
    </div>
  );
}
