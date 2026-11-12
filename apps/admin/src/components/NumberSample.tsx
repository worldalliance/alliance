import type { FormValue } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { inputText } from "./VariableSamples";

export const readNumberSample = (
  sample: FormValue | undefined,
): { value: number; error?: string } => ({
  value: typeof sample === "number" ? sample : 0,
});

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
    <label className="flex flex-1 items-center gap-2 text-xs text-gray-600">
      <span className="shrink-0">Preview with</span>
      <input
        type="number"
        min={0}
        step={1}
        value={readNumberSample(value).value}
        onChange={(event) =>
          onChange(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
        }
        title="Sample number used only for the preview below"
        aria-label={`Preview with, for ${inputName}`}
        className={cn(inputText, "min-w-0 flex-1")}
      />
    </label>
  );
}
