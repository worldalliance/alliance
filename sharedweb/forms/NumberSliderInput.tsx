import type {
  FormValue,
  NumberField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";

// `validateFormSchema` rejects a slider without bounds, so these only cover a
// schema written before that check existed.
const FALLBACK_MIN = 0;
const FALLBACK_MAX = 100;

const THUMB_CLASSES =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:bg-white";
const TRACK_CLASSES =
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:bg-transparent";
const THUMB_ERROR =
  "[&::-webkit-slider-thumb]:border-red-500 [&::-moz-range-thumb]:border-red-500";
const THUMB_ANSWERED =
  "[&::-webkit-slider-thumb]:border-green [&::-moz-range-thumb]:border-green";
const THUMB_UNANSWERED =
  "[&::-webkit-slider-thumb]:border-zinc-400 [&::-moz-range-thumb]:border-zinc-400";

export function NumberSliderInput({
  field,
  value,
  onChange,
  disabled,
  required,
  hasError,
}: {
  field: NumberField;
  value?: FormValue;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
}) {
  const min = field.min ?? FALLBACK_MIN;
  const max = field.max ?? FALLBACK_MAX;
  const step = field.allowDecimals ? (field.step ?? "any") : (field.step ?? 1);

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  const answered = Number.isFinite(numeric);
  const position = answered ? Math.min(max, Math.max(min, numeric)) : min;
  const filledPercent =
    max > min ? ((position - min) / (max - min)) * 100 : answered ? 100 : 0;

  const commit = (next: number) => {
    if (!onChange) return;
    if (field.allowDecimals && field.decimalPlaces !== undefined) {
      const factor = Math.pow(10, field.decimalPlaces);
      onChange(Math.round(next * factor) / factor);
      return;
    }
    onChange(next);
  };

  // While unanswered the thumb parks at `min`, so a user whose answer *is* `min`
  // would move it nowhere and the input would never fire a change event. Any
  // interaction therefore records the position the thumb is already at.
  const answerOnFirstInteraction = () => {
    if (!answered && !disabled) commit(position);
  };

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "text-2xl tabular-nums",
          answered ? "text-zinc-900" : "text-zinc-400",
        )}
      >
        {answered ? position : "—"}
      </div>
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-200" />
        {answered && (
          <div
            className={cn(
              "absolute h-1.5 rounded-full",
              hasError ? "bg-red-500" : "bg-green",
            )}
            style={{ width: `${filledPercent}%` }}
          />
        )}
        <input
          type="range"
          value={position}
          min={min}
          max={max}
          step={step}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-valuetext={answered ? undefined : "No answer selected"}
          onPointerDown={answerOnFirstInteraction}
          onKeyDown={answerOnFirstInteraction}
          onChange={
            onChange ? (e) => commit(parseFloat(e.target.value)) : undefined
          }
          className={cn(
            // `!` because a global `input { background-color: white }` rule
            // would otherwise paint over the track underneath.
            "relative h-5 w-full appearance-none !bg-transparent focus:outline-none",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            TRACK_CLASSES,
            THUMB_CLASSES,
            hasError
              ? THUMB_ERROR
              : answered
                ? THUMB_ANSWERED
                : THUMB_UNANSWERED,
          )}
        />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-zinc-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
