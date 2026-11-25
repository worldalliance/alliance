import { cn } from "../../ui/cn";
import { controlClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { VariableTextField } from "../VariableTextField";

type FieldLabelEditorProps = {
  value: string | null;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function FieldLabelEditor({
  value,
  onChange,
  label = "Question",
  placeholder = "Enter field label",
}: FieldLabelEditorProps) {
  return (
    <Field label={label}>
      {(control) => (
        <VariableTextField
          id={control.id}
          aria-describedby={control["aria-describedby"]}
          multiline
          minRows={1}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(controlClass, "resize-none py-1.5")}
        />
      )}
    </Field>
  );
}
