import {
  CONTINUE_LABEL,
  PUT_HERE_LABEL,
} from "@alliance/common/expression/undecided-messages";
import type { PartFallback } from "@alliance/shared/client";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";

const FALLBACK_LABELS: Record<PartFallback, string> = {
  put_here: PUT_HERE_LABEL,
  continue: CONTINUE_LABEL,
};

const isFallback = (value: string): value is PartFallback =>
  Object.hasOwn(FALLBACK_LABELS, value);

function fallbackOf(value: string): PartFallback | null {
  if (value === "") return null;
  if (!isFallback(value)) throw new Error(`unknown fallback: ${value}`);
  return value;
}

export default function FallbackSelect({
  value,
  onChange,
  disabled,
}: {
  value: PartFallback | null;
  onChange: (value: PartFallback | null) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      label="When the condition is undecided"
      help="Needed only when a member's condition can have no answer."
      className="max-w-md"
    >
      {(control) => (
        <Select
          {...control}
          value={value ?? ""}
          disabled={disabled}
          onChange={(event) => onChange(fallbackOf(event.target.value))}
        >
          <option value="">Not chosen</option>
          {Object.entries(FALLBACK_LABELS).map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
