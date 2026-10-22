import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import type { ExprValue } from "@alliance/common/forms/variable-expression";
import { cn } from "@alliance/shared/styles/util";
import { inputText } from "./VariableSamples";

/** Typed sample counts by option value; a blank one reads as 0. */
export type CountSample = Readonly<Record<string, string>>;

const PRESETS = [
  { label: "0", count: "0" },
  { label: "1", count: "1" },
  { label: "many", count: "25" },
];

const countOptions = (field: AnyField | undefined) =>
  field && fieldHasOptions(field) ? field.options : [];

const countError = (text: string | undefined): string | undefined =>
  text === undefined || /^\s*\d*\s*$/.test(text)
    ? undefined
    : `"${text}" isn't a whole number of members.`;

export const readCountSample = (
  field: AnyField | undefined,
  sample: CountSample,
): { value: ExprValue; error?: string } => {
  if (!field || !fieldHasOptions(field)) return { value: undefined };
  const options = field.options;
  const invalid = options.find((option) => countError(sample[option.value]));
  if (invalid) {
    return { value: undefined, error: countError(sample[invalid.value]) };
  }
  return {
    value: Object.fromEntries(
      options.map((option) => [
        option.value,
        Number(sample[option.value]?.trim() || 0),
      ]),
    ),
  };
};

type CountSamplesProps = {
  inputName: string;
  field: AnyField;
  sample: CountSample;
  onChange: (next: CountSample) => void;
};

export function CountSamples({
  inputName,
  field,
  sample,
  onChange,
}: CountSamplesProps) {
  const options = countOptions(field);
  return (
    <details className="pl-16 text-[10px] text-gray-500">
      <summary className="cursor-pointer">Sample counts</summary>
      <div className="mt-1 flex items-center gap-1">
        <span>Set all to</span>
        {PRESETS.map(({ label, count }) => (
          <button
            key={label}
            type="button"
            onClick={() =>
              onChange(
                Object.fromEntries(
                  options.map((option) => [option.value, count]),
                ),
              )
            }
            title={`Set every sample count for ${inputName} to ${count}`}
            className="rounded border border-gray-200 px-1.5 hover:bg-gray-50"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-1 grid max-h-60 grid-cols-3 gap-x-4 gap-y-1 overflow-y-auto pr-1">
        {options.map((option) => {
          const text = sample[option.value] ?? "";
          return (
            <label
              key={option.value}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate font-mono" title={option.label}>
                {option.value}
              </span>
              <input
                inputMode="numeric"
                value={text}
                placeholder="0"
                aria-label={`Sample count for ${option.value} in ${inputName}`}
                onChange={(event) =>
                  onChange({ ...sample, [option.value]: event.target.value })
                }
                className={cn(
                  inputText,
                  "w-16 py-0.5",
                  countError(text) && "border-red-400",
                )}
              />
            </label>
          );
        })}
      </div>
    </details>
  );
}
