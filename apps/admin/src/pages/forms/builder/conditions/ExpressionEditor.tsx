import { useEffect, useRef } from "react";
import { Field } from "../../../../ui/templates/Form";
import { Textarea } from "../../../../ui/Textarea";
import { focusInPlace } from "../kit/revealInPane";

export function ExpressionEditor({
  focusOnMount = false,
  text,
  error,
  onChange,
}: {
  /** Set when the reader just asked for the expression, so typing goes there. */
  focusOnMount?: boolean;
  text: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusOnMount) focusInPlace(ref.current);
  }, [focusOnMount]);
  return (
    <Field
      label="Expression"
      help="Combine rules by name with AND, OR, NOT and parentheses."
      error={error}
    >
      {(control) => (
        <Textarea
          {...control}
          ref={ref}
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
