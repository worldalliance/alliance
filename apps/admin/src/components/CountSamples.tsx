import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import type { ExprValue } from "@alliance/common/forms/variable-expression";
import Button, { ButtonVariant } from "../ui/Button";
import { Disclosure } from "../ui/Disclosure";
import { Input } from "../ui/Input";

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

/** What the formula reads as each option's count while previewing. */
export function CountSamples({
  inputName,
  field,
  sample,
  onChange,
}: CountSamplesProps) {
  const options = countOptions(field);
  return (
    <Disclosure summary="Sample counts">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
          <span>Set all to</span>
          {PRESETS.map(({ label, count }) => (
            <Button
              key={label}
              variant={ButtonVariant.Default}
              size="small"
              title={`Set every sample count for ${inputName} to ${count}`}
              onClick={() =>
                onChange(
                  Object.fromEntries(
                    options.map((option) => [option.value, count]),
                  ),
                )
              }
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex max-h-60 flex-wrap gap-x-6 gap-y-2 overflow-y-auto">
          {options.map((option) => {
            const text = sample[option.value] ?? "";
            return (
              <label
                key={option.value}
                className="flex w-56 items-center justify-between gap-2 text-caption"
              >
                <span className="truncate font-mono" title={option.label}>
                  {option.value}
                </span>
                <Input
                  inputMode="numeric"
                  value={text}
                  placeholder="0"
                  aria-label={`Sample count for ${option.value} in ${inputName}`}
                  aria-invalid={countError(text) ? true : undefined}
                  onChange={(event) =>
                    onChange({ ...sample, [option.value]: event.target.value })
                  }
                  className="w-20"
                />
              </label>
            );
          })}
        </div>
      </div>
    </Disclosure>
  );
}
