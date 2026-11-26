import type {
  AnyField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import {
  inputSourceFormId,
  isCountInput,
  isListInput,
  isSourceInput,
  type VariableInput,
  type VariableListInput,
} from "@alliance/common/forms/variable-inputs";
import { ItemRow } from "../pages/forms/builder/kit/ItemList";
import { CountSamples, type CountSample } from "./CountSamples";
import {
  ListInputEditor,
  ListPropertyNames,
  SubmissionSamples,
} from "./ListSamples";
import { NumberSample } from "./NumberSample";
import { inputHelp } from "./variableInputHelp";
import {
  fieldChoices,
  FieldPicker,
  inputModeOfInput,
  InputModePicker,
  SourceFormLoadError,
  SourceFormPicker,
  type InputMode,
  type InputSources,
} from "./VariableInputPickers";
import {
  SampleAnswer,
  sampleRows,
  type SubmissionSample,
} from "./VariableSamples";

type VariableInputRowProps = {
  name: string;
  input: VariableInput;
  field: AnyField | undefined;
  sources: InputSources;
  type: string | undefined;
  readingError: string | undefined;
  sample: FormValue | undefined;
  submissions: SubmissionSample[];
  counts: CountSample;
  countsAvailable: boolean;
  randomAvailable: boolean;
  onModeChange: (mode: InputMode) => void;
  onInputChange: (next: VariableInput) => void;
  onFieldPick: (picked: AnyField) => void;
  onSourceChange: (sourceFormId: number | undefined) => void;
  onSampleChange: (next: FormValue) => void;
  onSubmissionsChange: (next: SubmissionSample[]) => void;
  onCountsChange: (next: CountSample) => void;
  onRemove: () => void;
};

/**
 * One input of a formula: what it reads (mode, form, question), the sample
 * answers the preview uses in its place, and its type as the formula sees it.
 */
export function VariableInputRow({
  name,
  input,
  field,
  sources,
  type,
  readingError,
  sample,
  submissions,
  counts,
  countsAvailable,
  randomAvailable,
  onModeChange,
  onInputChange,
  onFieldPick,
  onSourceChange,
  onSampleChange,
  onSubmissionsChange,
  onCountsChange,
  onRemove,
}: VariableInputRowProps) {
  const sourceFormId = inputSourceFormId(input);
  const help = inputHelp(input, field);
  return (
    <ItemRow name={name} onRemove={onRemove}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-xs">{name}</span>
        <InputModePicker
          inputName={name}
          mode={inputModeOfInput(input)}
          countsAvailable={countsAvailable}
          randomAvailable={randomAvailable}
          onChange={onModeChange}
        />
        {input.kind === "random" ? (
          <NumberSample
            inputName={name}
            value={sample}
            onChange={onSampleChange}
          />
        ) : (
          <>
            <SourceFormPicker
              inputName={name}
              sourceFormId={sourceFormId}
              counting={isCountInput(input)}
              sources={sources}
              onChange={onSourceChange}
            />
            <FieldPicker
              inputName={name}
              input={input}
              field={field}
              choices={fieldChoices(input, sources)}
              sources={sources}
              onPick={onFieldPick}
            />
          </>
        )}
      </div>
      <SourceFormLoadError sourceFormId={sourceFormId} sources={sources} />
      {input.kind === "answeredCount" && field && (
        <NumberSample
          inputName={name}
          value={sample}
          onChange={onSampleChange}
        />
      )}
      {input.kind === "field" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-caption text-fg-muted">
            Sample answer
          </span>
          <SampleAnswer
            inputName={name}
            field={field}
            value={sample}
            error={readingError}
            onChange={onSampleChange}
          />
        </div>
      )}
      {(field || input.kind === "random") && (
        <p className="font-mono text-xs text-fg-muted" title={help.notes}>
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
      {input.kind === "aggregate" && field && (
        <CountSamples
          inputName={name}
          field={field}
          sample={counts}
          onChange={onCountsChange}
        />
      )}
      {readingError && (
        <p role="alert" className="text-caption text-danger">
          {readingError} Reads as undefined.
        </p>
      )}
    </ItemRow>
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
        <ListPropertyNames
          inputName={inputName}
          input={input}
          field={field}
          onInputChange={onInputChange}
        />
      );
    default:
      throw new Error(`unknown list input kind: ${kind satisfies never}`);
  }
}
