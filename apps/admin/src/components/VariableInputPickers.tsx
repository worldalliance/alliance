import type { AnyField } from "@alliance/common/forms/form-schema";
import {
  inputSourceFormId,
  type VariableInput,
} from "@alliance/common/forms/variable-inputs";
import type { VariableFieldScope } from "@alliance/common/forms/variables";
import type { FormOption } from "@alliance/shared/lib/useFormsAdmin";
import { FormFieldsStatus } from "@alliance/shared/lib/useFormSchema";
import { cn } from "@alliance/shared/styles/util";
import { FormPickerError, formFieldsErrorReason } from "./FormPickerError";
import { inputText } from "./VariableSamples";

export type InputSources = {
  /** Readable fields of a source form, or of this form for `undefined`. */
  fieldsFor: (sourceFormId: number | undefined) => AnyField[];
  statusOf: (sourceFormId: number) => FormFieldsStatus | undefined;
  /** Every form but this one. */
  forms: FormOption[];
  /** This form, once saved, for an aggregate counting its own answers. */
  ownForm: FormOption | undefined;
  /** False while `forms` is loading or failed to load. */
  formsLoaded: boolean;
  scope: VariableFieldScope;
};

export const fieldChoices = (input: VariableInput, sources: InputSources) => {
  const fields = sources.fieldsFor(inputSourceFormId(input));
  return input.kind === "aggregate"
    ? fields.filter((field) => field.kind === "multiselect")
    : fields;
};

export enum InputMode {
  Answers = "answers",
  Counts = "counts",
}

const KIND_INPUT_MODE: Record<VariableInput["kind"], InputMode> = {
  field: InputMode.Answers,
  list: InputMode.Answers,
  sourceField: InputMode.Answers,
  sourceList: InputMode.Answers,
  aggregate: InputMode.Counts,
};

export const inputModeOfInput = (input: VariableInput): InputMode =>
  KIND_INPUT_MODE[input.kind];

export function InputModePicker({
  inputName,
  mode,
  countsAvailable,
  onChange,
}: {
  inputName: string;
  mode: InputMode;
  countsAvailable: boolean;
  onChange: (mode: InputMode) => void;
}) {
  return (
    <select
      value={mode}
      aria-label={`What ${inputName} reads`}
      onChange={(event) =>
        onChange(
          event.target.value === InputMode.Counts
            ? InputMode.Counts
            : InputMode.Answers,
        )
      }
      className={cn(inputText, "bg-white w-36 shrink-0")}
    >
      <option value={InputMode.Answers}>Answers</option>
      <option value={InputMode.Counts} disabled={!countsAvailable}>
        Aggregate counts
      </option>
    </select>
  );
}

type SourceFormPickerProps = {
  inputName: string;
  sourceFormId: number | undefined;
  counting: boolean;
  sources: InputSources;
  onChange: (sourceFormId: number | undefined) => void;
};

export function SourceFormPicker({
  inputName,
  sourceFormId,
  counting,
  sources,
  onChange,
}: SourceFormPickerProps) {
  const forms =
    counting && sources.ownForm
      ? [sources.ownForm, ...sources.forms]
      : sources.forms;
  const listed =
    sourceFormId === undefined || forms.some(({ id }) => id === sourceFormId);
  const missing = !listed && sources.formsLoaded;
  return (
    <select
      value={sourceFormId ?? ""}
      aria-label={`Form read by ${inputName}`}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? undefined : Number(event.target.value),
        )
      }
      className={cn(
        inputText,
        "bg-white w-44 shrink-0",
        missing && "border-red-400",
      )}
    >
      {!counting && <option value="">This form</option>}
      {!listed && (
        <option value={sourceFormId}>
          {missing
            ? `Missing form — #${sourceFormId}`
            : `Form #${sourceFormId}`}
        </option>
      )}
      {forms.map((form) => (
        <option key={form.id} value={form.id}>
          {form === sources.ownForm ? "This form's submissions" : form.title} (#
          {form.id})
        </option>
      ))}
    </select>
  );
}

const sourceStatus = (
  input: VariableInput,
  sources: InputSources,
): FormFieldsStatus => {
  const sourceFormId = inputSourceFormId(input);
  return sourceFormId === undefined
    ? FormFieldsStatus.Ready
    : (sources.statusOf(sourceFormId) ?? FormFieldsStatus.Pending);
};

const unreadFieldLabel = (params: {
  input: VariableInput;
  sources: InputSources;
  choices: AnyField[];
}): string => {
  const { input, sources, choices } = params;
  const status = sourceStatus(input, sources);
  switch (status) {
    case FormFieldsStatus.Pending:
      return "Loading questions…";
    case FormFieldsStatus.LoadFailed:
    case FormFieldsStatus.SchemaUnreadable:
      return input.fieldId === "" ? "Pick a question" : input.fieldId;
    case FormFieldsStatus.Ready:
      if (input.fieldId !== "") {
        return `Missing or unusable field — ${input.fieldId}`;
      }
      return input.kind === "aggregate" && choices.length === 0
        ? "No multiselect questions on this form"
        : "Pick a question";
    default:
      throw new Error(`unknown status: ${status satisfies never}`);
  }
};

export function SourceFormLoadError({
  sourceFormId,
  sources,
}: {
  sourceFormId: number | undefined;
  sources: InputSources;
}) {
  const reason =
    sourceFormId === undefined
      ? null
      : formFieldsErrorReason(sources.statusOf(sourceFormId));
  return reason && <FormPickerError reason={reason} className="pl-16" />;
}

type FieldPickerProps = {
  inputName: string;
  input: VariableInput;
  field: AnyField | undefined;
  choices: AnyField[];
  sources: InputSources;
  onPick: (field: AnyField) => void;
};

export function FieldPicker({
  inputName,
  input,
  field,
  choices,
  sources,
  onPick,
}: FieldPickerProps) {
  return (
    <select
      value={input.fieldId}
      aria-label={`Field read by ${inputName}`}
      onChange={(event) => {
        const picked = choices.find(
          (candidate) => candidate.id === event.target.value,
        );
        if (picked) onPick(picked);
      }}
      className={cn(
        inputText,
        "bg-white flex-1",
        !field &&
          sourceStatus(input, sources) !== FormFieldsStatus.Pending &&
          "border-red-400",
      )}
    >
      {/* Without a matching option, the browser displays the first eligible
          field. */}
      {!field && (
        <option value={input.fieldId}>
          {unreadFieldLabel({ input, sources, choices })}
        </option>
      )}
      {choices.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {candidate.label || "(no label)"} ({candidate.kind}) — {candidate.id}
        </option>
      ))}
    </select>
  );
}
