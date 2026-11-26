import { Field } from "../../../ui/templates/Form";
import { Textarea } from "../../../ui/Textarea";

export function ExpressionEditor({
  text,
  error,
  onChange,
}: {
  text: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  return (
    <Field
      label="Expression"
      help="Combine rules by name with AND, OR, NOT and parentheses."
      error={error}
    >
      {(control) => (
        <Textarea
          {...control}
          rows={3}
          className="min-h-0 font-mono"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="condition1 AND (condition2 OR NOT condition3)"
        />
      )}
    </Field>
  );
}
