import type {
  AnyField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import {
  inputSourceFormId,
  isListInput,
  isSourceInput,
  type VariableInput,
  type VariableListInput,
} from "@alliance/common/forms/variable-inputs";
import { X } from "lucide-react";
import {
  FieldPicker,
  SourceFormLoadError,
  SourceFormPicker,
  type InputSources,
} from "./VariableInputPickers";
import {
  ListInputEditor,
  ListPropertyNames,
  SampleAnswer,
  sampleRows,
  SubmissionSamples,
  type SubmissionSample,
} from "./VariableSamples";
import { inputHelp } from "./variableInputHelp";

type VariableInputRowProps = {
  name: string;
  input: VariableInput;
  field: AnyField | undefined;
  sources: InputSources;
  type: string | undefined;
  readingError: string | undefined;
  sample: FormValue | undefined;
  submissions: SubmissionSample[];
  onInputChange: (next: VariableInput) => void;
  onFieldPick: (picked: AnyField) => void;
  onSourceChange: (sourceFormId: number | undefined) => void;
  onSampleChange: (next: FormValue) => void;
  onSubmissionsChange: (next: SubmissionSample[]) => void;
  onRemove: () => void;
};

export function VariableInputRow({
  name,
  input,
  field,
  sources,
  type,
  readingError,
  sample,
  submissions,
  onInputChange,
  onFieldPick,
  onSourceChange,
  onSampleChange,
  onSubmissionsChange,
  onRemove,
}: VariableInputRowProps) {
  const sourceFormId = inputSourceFormId(input);
  const help = inputHelp(input, field);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-xs text-gray-600">
          {name}
        </span>
        <SourceFormPicker
          inputName={name}
          sourceFormId={sourceFormId}
          sources={sources}
          onChange={onSourceChange}
        />
        <FieldPicker
          inputName={name}
          input={input}
          field={field}
          choices={sources.fieldsFor(sourceFormId)}
          sources={sources}
          onPick={onFieldPick}
        />
        {input.kind === "field" && (
          <SampleAnswer
            inputName={name}
            field={field}
            value={sample}
            error={readingError}
            onChange={onSampleChange}
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          title="Remove input"
          aria-label={`Remove ${name}`}
          className="p-1 text-gray-400 hover:text-red-500"
        >
          <X size={14} />
        </button>
      </div>
      <SourceFormLoadError sourceFormId={sourceFormId} sources={sources} />
      {field && (
        <p
          className="pl-16 font-mono text-[10px] text-gray-500"
          title={help.notes}
        >
          {name}: {type}
        </p>
      )}
      {isListInput(input) && field?.kind === "list" && (
        <ListInputEditors
          inputName={name}
          input={input}
          field={field}
          sample={sample}
          onInputChange={onInputChange}
          onSampleChange={onSampleChange}
        />
      )}
      {isSourceInput(input) && field && (
        <SubmissionSamples
          inputName={name}
          input={input}
          field={field}
          submissions={submissions}
          onChange={onSubmissionsChange}
        />
      )}
      {readingError && (
        <p className="pl-16 text-[10px] text-red-500">
          {readingError} Reads as undefined.
        </p>
      )}
    </div>
  );
}

function ListInputEditors({
  inputName,
  input,
  field,
  sample,
  onInputChange,
  onSampleChange,
}: {
  inputName: string;
  input: VariableListInput;
  field: ListField;
  sample: FormValue | undefined;
  onInputChange: (next: VariableListInput) => void;
  onSampleChange: (next: FormValue) => void;
}) {
  const { kind } = input;
  switch (kind) {
    case "list":
      return (
        <ListInputEditor
          inputName={inputName}
          input={input}
          field={field}
          rows={sampleRows(sample)}
          onInputChange={onInputChange}
          onRowsChange={onSampleChange}
        />
      );
    case "sourceList":
      return (
        <div className="pl-16 space-y-2">
          <ListPropertyNames
            inputName={inputName}
            input={input}
            field={field}
            onInputChange={onInputChange}
          />
        </div>
      );
    default:
      throw new Error(`unknown list input kind: ${kind satisfies never}`);
  }
}
