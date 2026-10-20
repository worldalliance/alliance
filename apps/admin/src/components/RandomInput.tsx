import type { FormValue } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import type { InputModeHelp } from "./VariableHelpModal";
import { inputText } from "./VariableSamples";

export const RANDOM_INPUT_HELP: InputModeHelp = {
  notes:
    "A whole number from 0 up. Each member gets their own, the same on every visit and device, and each random input picks separately. Take it modulo a list's length to pick one entry.",
  example: (input) => `["A", "B", "C"][${input} % 3]`,
};

export const readRandomSample = (
  sample: FormValue | undefined,
): { value: number; error?: string } => ({
  value: typeof sample === "number" ? sample : 0,
});

export function RandomSample({
  inputName,
  value,
  onChange,
}: {
  inputName: string;
  value: FormValue | undefined;
  onChange: (next: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={readRandomSample(value).value}
      onChange={(event) =>
        onChange(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
      }
      title="Sample number used only for the preview below"
      aria-label={`Sample number for ${inputName}`}
      className={cn(inputText, "flex-1")}
    />
  );
}
