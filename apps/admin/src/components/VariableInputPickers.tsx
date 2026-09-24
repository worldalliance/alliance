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
  /** False while `forms` is loading or failed to load. */
  formsLoaded: boolean;
  scope: VariableFieldScope;
};

type SourceFormPickerProps = {
  inputName: string;
  sourceFormId: number | undefined;
  sources: InputSources;
  onChange: (sourceFormId: number | undefined) => void;
};

export function SourceFormPicker({
  inputName,
  sourceFormId,
  sources,
  onChange,
}: SourceFormPickerProps) {
  const listed =
    sourceFormId === undefined ||
    sources.forms.some(({ id }) => id === sourceFormId);
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
      <option value="">This form</option>
      {!listed && (
        <option value={sourceFormId}>
          {missing
            ? `Missing form — #${sourceFormId}`
            : `Form #${sourceFormId}`}
        </option>
      )}
      {sources.forms.map((form) => (
        <option key={form.id} value={form.id}>
          {form.title} (#{form.id})
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

const unreadFieldLabel = (
  input: VariableInput,
  sources: InputSources,
): string => {
  const status = sourceStatus(input, sources);
  switch (status) {
    case FormFieldsStatus.Pending:
      return "Loading questions…";
    case FormFieldsStatus.LoadFailed:
    case FormFieldsStatus.SchemaUnreadable:
      return input.fieldId === "" ? "Pick a question" : input.fieldId;
    case FormFieldsStatus.Ready:
      return input.fieldId === ""
        ? "Pick a question"
        : `Missing or unusable field — ${input.fieldId}`;
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
          {unreadFieldLabel(input, sources)}
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
