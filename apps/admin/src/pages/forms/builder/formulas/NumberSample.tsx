import type { FormValue } from "@alliance/common/forms/form-schema";
import { Input } from "../../../../ui/Input";

export const readNumberSample = (
  sample: FormValue | undefined,
): { value: number; error?: string } => ({
  value: typeof sample === "number" ? sample : 0,
});

/** The whole number a count or random input is previewed with. */
export function NumberSample({
  inputName,
  value,
  onChange,
}: {
  inputName: string;
  value: FormValue | undefined;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-caption text-fg-muted">
      <span className="shrink-0">Preview with</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={readNumberSample(value).value}
        onChange={(event) =>
          onChange(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
        }
        aria-label={`Preview with, for ${inputName}`}
        className="w-28"
      />
    </label>
  );
}
