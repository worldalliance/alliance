import type {
  AnyField,
  FormValue,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { fieldHasOptions } from "@alliance/common/forms/form-schema";
import type {
  ExprRecord,
  ExprValue,
} from "@alliance/common/forms/variable-expression";
import type {
  VariableFieldInput,
  VariableListInput,
  VariableSourceInput,
} from "@alliance/common/forms/variable-inputs";
import {
  FIELD_KIND_VARIABLE_INPUT_MODE,
  formValueToExprValue,
  readableListSubFields,
  VariableInputMode,
} from "@alliance/common/forms/variables";
import { cn } from "../ui/cn";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { controlClass } from "../ui/styles";

// BACKCOMPAT(input-classes): the Preview, Aggregate and Row tabs still import
// these; remove with their last importer.
export const inputText = cn(controlClass, "h-control");
export const inputPad = cn(controlClass, "py-2");

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

export type SampleReading = { value: ExprValue; error?: string };

export const readSampleAnswer = (
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
  input: VariableFieldInput | VariableListInput,
  field: AnyField | undefined,
  sample: FormValue | undefined,
): SampleReading => {
  switch (input.kind) {
    case "field":
    case "sourceField":
      return readSampleAnswer(field, sample);
    case "list":
    case "sourceList":
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

/** The control a sample answer is typed or picked in, shaped like the field's own. */
export function SampleAnswer({
  inputName,
  field,
  value,
  error,
  onChange,
}: SampleAnswerProps) {
  const mode = inputModeOf(field);
  const shared = {
    "aria-label": `Sample answer for ${inputName}`,
    "aria-invalid": error ? (true as const) : undefined,
    className: "max-w-xs",
  };
  const options = fieldOptions(field);

  switch (mode) {
    case VariableInputMode.Choice:
      return (
        <Select
          {...shared}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">unanswered</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {optionText(option)}
            </option>
          ))}
        </Select>
      );

    case VariableInputMode.Choices:
      return (
        <Select
          {...shared}
          multiple
          size={Math.min(Math.max(options.length, 2), 3)}
          className="h-auto max-w-xs py-1"
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
        </Select>
      );

    case VariableInputMode.Boolean:
      return (
        <Select
          {...shared}
          value={typeof value === "boolean" ? String(value) : ""}
          onChange={(event) =>
            onChange(event.target.value ? event.target.value === "true" : "")
          }
        >
          <option value="">unanswered</option>
          <option value="true">Ticked</option>
          <option value="false">Not ticked</option>
        </Select>
      );

    case VariableInputMode.Number:
    case VariableInputMode.Text:
    case VariableInputMode.City:
    case VariableInputMode.None:
      return (
        <Input
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

export type SubmissionSample = FormValue | undefined;

export const readSubmissionSamples = (
  input: VariableSourceInput,
  field: AnyField | undefined,
  submissions: readonly SubmissionSample[],
): SampleReading => {
  let error: string | undefined;
  const value = submissions.map((sample, index) => {
    const reading = readInputSample(input, field, sample);
    if (reading.error) error ??= `Submission ${index + 1}: ${reading.error}`;
    return reading.value;
  });
  return { value, error };
};
