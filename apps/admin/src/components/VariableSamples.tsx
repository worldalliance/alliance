import type {
  AnyField,
  FormValue,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { fieldHasOptions } from "@alliance/common/forms/form-schema";
import type {
  ExprRecord,
  ExprValue,
} from "@alliance/common/forms/variable-expression";
import {
  FIELD_KIND_VARIABLE_INPUT_MODE,
  formValueToExprValue,
  listInputPropertyErrors,
  readableListSubFields,
  VariableInputMode,
  type VariableInput,
  type VariableListInput,
} from "@alliance/common/forms/variables";
import { cn } from "@alliance/shared/styles/util";
import { Plus, Trash2 } from "lucide-react";

const inputBase =
  "w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";
export const inputText = cn(inputBase, "px-3 py-1.5");
export const inputPad = cn(inputBase, "px-3 py-2");

const SAMPLE_PLACEHOLDER: Record<VariableInputMode, string> = {
  [VariableInputMode.Number]: "sample",
  [VariableInputMode.Text]: "sample",
  [VariableInputMode.City]: "city name",
  [VariableInputMode.Boolean]: "",
  [VariableInputMode.Choice]: "",
  [VariableInputMode.Choices]: "",
  [VariableInputMode.None]: "sample",
};

export const inputModeOf = (field: AnyField | undefined) =>
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

type SampleReading = { value: ExprValue; error?: string };

const readSampleAnswer = (
  field: AnyField | undefined,
  sample: FormValue | undefined,
): SampleReading => {
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

export const sampleRows = (value: FormValue | undefined): ListFieldValue =>
  Array.isArray(value)
    ? [...value].flatMap((row) => (typeof row === "object" ? [row] : []))
    : [];

// Sample rows have no other answers to decide a sub-field's visibility, so
// every sub-field reads as shown.
const readListSample = (
  input: VariableListInput,
  field: AnyField | undefined,
  sample: FormValue | undefined,
): SampleReading => {
  if (field?.kind !== "list") return { value: undefined };
  const subFields = readableListSubFields(field.fields).filter((sub) =>
    Object.hasOwn(input.properties, sub.id),
  );
  let error: string | undefined;
  const value = sampleRows(sample).map(
    (row, index): ExprRecord =>
      Object.fromEntries(
        subFields.map((sub) => {
          const property = input.properties[sub.id];
          const cell = readSampleAnswer(sub, row[sub.id]);
          if (cell.error) {
            error ??= `Row ${index + 1}, ${property}: ${cell.error}`;
          }
          return [property, cell.value];
        }),
      ),
  );
  return { value, error };
};

export const readInputSample = (
  input: VariableInput,
  field: AnyField | undefined,
  sample: FormValue | undefined,
): SampleReading => {
  switch (input.kind) {
    case "field":
      return readSampleAnswer(field, sample);
    case "list":
      return readListSample(input, field, sample);
    default:
      throw new Error(`unknown input kind: ${input satisfies never}`);
  }
};

type SampleAnswerProps = {
  inputName: string;
  field: AnyField | undefined;
  value: FormValue | undefined;
  error: string | undefined;
  onChange: (next: FormValue) => void;
};

export function SampleAnswer({
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

const DISALLOWED_PROPERTY_NAME_CHARS = /[^A-Za-z0-9_]/g;

type ListInputEditorProps = {
  inputName: string;
  input: VariableListInput;
  field: ListField;
  rows: ListFieldValue;
  onInputChange: (next: VariableListInput) => void;
  onRowsChange: (next: ListFieldValue) => void;
};

export function ListInputEditor({
  inputName,
  input,
  field,
  rows,
  onInputChange,
  onRowsChange,
}: ListInputEditorProps) {
  const subFields = readableListSubFields(field.fields);
  const propertyErrors = listInputPropertyErrors({
    inputName,
    input,
    subFields: field.fields,
  });
  const setRow = (index: number, next: Record<string, FormValue>) =>
    onRowsChange(rows.map((row, i) => (i === index ? next : row)));

  return (
    <div className="pl-16 space-y-2">
      {subFields.length === 0 ? (
        <p className="text-[10px] text-gray-500">
          No sub-field a formula can read.{" "}
          <span className="font-mono">{inputName}.length</span> still counts the
          rows.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {subFields.map((sub) => (
            <label
              key={sub.id}
              className="flex items-center gap-1.5 text-xs text-gray-500"
            >
              {sub.label || "(no label)"}
              <input
                value={input.properties[sub.id] ?? ""}
                aria-label={`${inputName} property name for ${sub.label || sub.id}`}
                title="Property name each row uses for this sub-field"
                onChange={(event) =>
                  onInputChange({
                    ...input,
                    properties: {
                      ...input.properties,
                      [sub.id]: event.target.value.replace(
                        DISALLOWED_PROPERTY_NAME_CHARS,
                        "",
                      ),
                    },
                  })
                }
                className={cn(inputText, "w-28 py-1 font-mono text-xs")}
              />
            </label>
          ))}
        </div>
      )}
      {propertyErrors.map((message, index) => (
        <p key={index} className="text-[10px] text-red-500">
          {message}
        </p>
      ))}
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="w-10 shrink-0 text-[10px] text-gray-500">
              row {index + 1}
            </span>
            {subFields.map((sub) => (
              <SampleAnswer
                key={sub.id}
                inputName={`${inputName} row ${index + 1}, ${sub.label || sub.id}`}
                field={sub}
                value={row[sub.id]}
                error={readSampleAnswer(sub, row[sub.id]).error}
                onChange={(next) => setRow(index, { ...row, [sub.id]: next })}
              />
            ))}
            <button
              type="button"
              onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
              title="Remove sample row"
              aria-label={`Remove sample row ${index + 1} of ${inputName}`}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onRowsChange([...rows, {}])}
          title="Add sample row"
          aria-label={`Add sample row to ${inputName}`}
          className="flex items-center gap-1 p-1 text-[10px] text-gray-400 hover:text-blue-600"
        >
          <Plus size={12} />
          {rows.length === 0 && "sample row"}
        </button>
      </div>
    </div>
  );
}
