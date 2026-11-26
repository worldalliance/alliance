import type {
  AnyField,
  FormValue,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import type {
  VariableListInput,
  VariableSourceInput,
} from "@alliance/common/forms/variable-inputs";
import {
  listInputPropertyErrors,
  readableListSubFields,
} from "@alliance/common/forms/variables";
import { Plus, Trash2 } from "lucide-react";
import Button, { ButtonVariant } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  readSampleAnswer,
  SampleAnswer,
  sampleRows,
  type SubmissionSample,
} from "./VariableSamples";

const DISALLOWED_PROPERTY_NAME_CHARS = /[^A-Za-z0-9_]/g;

function AddSampleButton({
  label,
  children,
  onClick,
}: {
  /** The button's accessible name: "Add sample row to input1". */
  label: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <div className="-ml-2.5">
      <Button
        variant={ButtonVariant.Ghost}
        size="small"
        aria-label={label}
        onClick={onClick}
      >
        <Plus aria-hidden="true" className="size-4" />
        {children}
      </Button>
    </div>
  );
}

function RemoveSampleButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant={ButtonVariant.Ghost}
      size="small"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </Button>
  );
}

type ListPropertyNamesProps = {
  inputName: string;
  input: VariableListInput;
  field: ListField;
  onInputChange: (next: VariableListInput) => void;
};

/** The property each row of a list input gives its sub-fields, which the formula reads. */
export function ListPropertyNames({
  inputName,
  input,
  field,
  onInputChange,
}: ListPropertyNamesProps) {
  const subFields = readableListSubFields(field.fields);
  const propertyErrors = listInputPropertyErrors({
    inputName,
    input,
    subFields: field.fields,
  });

  return (
    <div className="flex flex-col gap-2">
      {subFields.length === 0 ? (
        <p className="text-caption text-fg-muted">
          No sub-field a formula can read.{" "}
          <span className="font-mono">{inputName}.length</span> still counts the
          rows.
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {subFields.map((sub) => (
            <label
              key={sub.id}
              className="flex max-w-full items-center gap-2 text-caption text-fg-muted"
            >
              <span className="min-w-0">{sub.label || "(no label)"}</span>
              <Input
                value={input.properties[sub.id] ?? ""}
                aria-label={`${inputName} property name for ${sub.label || sub.id}`}
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
                className="w-36 shrink-0 font-mono text-caption"
              />
            </label>
          ))}
        </div>
      )}
      {propertyErrors.map((message, index) => (
        <p key={index} role="alert" className="text-caption text-danger">
          {message}
        </p>
      ))}
    </div>
  );
}

type SampleRowsProps = {
  inputName: string;
  field: ListField;
  rows: ListFieldValue;
  onRowsChange: (next: ListFieldValue) => void;
};

function SampleRows({ inputName, field, rows, onRowsChange }: SampleRowsProps) {
  const subFields = readableListSubFields(field.fields);
  const setRow = (index: number, next: Record<string, FormValue>) =>
    onRowsChange(rows.map((row, i) => (i === index ? next : row)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-caption text-fg-muted">
            Row {index + 1}
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
          <RemoveSampleButton
            label={`Remove sample row ${index + 1} of ${inputName}`}
            onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <AddSampleButton
        label={`Add sample row to ${inputName}`}
        onClick={() => onRowsChange([...rows, {}])}
      >
        Add sample row
      </AddSampleButton>
    </div>
  );
}

type ListInputEditorProps = ListPropertyNamesProps & {
  rows: ListFieldValue;
  onRowsChange: (next: ListFieldValue) => void;
};

export function ListInputEditor({
  rows,
  onRowsChange,
  ...names
}: ListInputEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <ListPropertyNames {...names} />
      <SampleRows
        inputName={names.inputName}
        field={names.field}
        rows={rows}
        onRowsChange={onRowsChange}
      />
    </div>
  );
}

type SubmissionSamplesProps = {
  inputName: string;
  input: VariableSourceInput;
  field: AnyField | undefined;
  submissions: readonly SubmissionSample[];
  onChange: (next: SubmissionSample[]) => void;
};

/** Sample answers for an input reading another form, one per submission. */
export function SubmissionSamples({
  inputName,
  input,
  field,
  submissions,
  onChange,
}: SubmissionSamplesProps) {
  const setSubmission = (index: number, next: SubmissionSample) =>
    onChange(submissions.map((sample, i) => (i === index ? next : sample)));

  const editor = (index: number, sample: SubmissionSample) => {
    const label = `${inputName} submission ${index + 1}`;
    switch (input.kind) {
      case "sourceField":
        return (
          <SampleAnswer
            inputName={label}
            field={field}
            value={sample}
            error={readSampleAnswer(field, sample).error}
            onChange={(next) => setSubmission(index, next)}
          />
        );
      case "sourceList":
        return field?.kind === "list" ? (
          <SampleRows
            inputName={label}
            field={field}
            rows={sampleRows(sample)}
            onRowsChange={(rows) => setSubmission(index, rows)}
          />
        ) : null;
      default:
        throw new Error(`unknown input kind: ${input satisfies never}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {submissions.map((sample, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2">
          <span className="w-24 shrink-0 pt-2 text-caption text-fg-muted">
            Submission {index + 1}
          </span>
          {editor(index, sample)}
          <RemoveSampleButton
            label={`Remove sample submission ${index + 1} of ${inputName}`}
            onClick={() => onChange(submissions.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <AddSampleButton
        label={`Add sample submission to ${inputName}`}
        onClick={() => onChange([...submissions, undefined])}
      >
        Add sample submission
      </AddSampleButton>
    </div>
  );
}
