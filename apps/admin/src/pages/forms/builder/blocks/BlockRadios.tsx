import { useId } from "react";
import { FieldGroup } from "../../../../ui/templates/Form";

/**
 * A few choices that each need words, as native radios in a `FieldGroup`.
 * Styled as `ui/Checkbox` is until `src/ui` has a radio of its own.
 */
export function BlockRadios<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <FieldGroup label={label}>
      {choices.map((choice) => (
        <label key={choice.value} className="flex items-center gap-2.5">
          <input
            type="radio"
            name={name}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            className="size-4 shrink-0 cursor-pointer accent-accent focus-ring"
          />
          {choice.label}
        </label>
      ))}
    </FieldGroup>
  );
}
