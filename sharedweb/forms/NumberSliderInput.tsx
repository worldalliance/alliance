import {
  formatNumberFieldValue,
  type FormValue,
  type NumberField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// `validateFormSchema` rejects a slider without bounds, so these only cover a
// schema written before that check existed.
const FALLBACK_MIN = 0;
const FALLBACK_MAX = 100;

/** Matches the `h-5 w-5` thumb, so the bubble can track the thumb's centre. */
const THUMB_SIZE_PX = 20;
/**
 * How far the tail's tip must stay inside each end of the bubble: the `rounded-md`
 * corner radius plus half the tail's rotated width, so it never straddles a corner.
 */
const TAIL_INSET_PX = 15;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

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

  const dragOrigin = useRef<{ x: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Laying the bubble out needs real pixels: it has to stay inside the track
  // while its tail stays inside its own rounded corners.
  const trackRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState({ track: 0, bubble: 0 });

  useLayoutEffect(() => {
    const track = trackRef.current;
    const bubble = bubbleRef.current;
    if (!track || !bubble) return;
    const measure = () => {
      const next = { track: track.clientWidth, bubble: bubble.offsetWidth };
      setWidths((prev) =>
        prev.track === next.track && prev.bubble === next.bubble ? prev : next,
      );
    };
    measure();
    // Watches the bubble too, since its width changes with the rendered value.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(bubble);
    return () => observer.disconnect();
  }, []);

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  const answered = Number.isFinite(numeric);
  const position = answered ? Math.min(max, Math.max(min, numeric)) : min;
  const fraction = max > min ? (position - min) / (max - min) : 0;
  const interactive = !disabled && !!onChange;

  // The thumb's centre travels between half a thumb-width in from each end,
  // not across the track's full width.
  const travel = Math.max(0, widths.track - THUMB_SIZE_PX);
  const thumbCentre = fraction * travel + THUMB_SIZE_PX / 2;
  // Centred on the thumb where there's room, otherwise flush to whichever end
  // it would have overflowed.
  const bubbleLeft = clamp(
    thumbCentre - widths.bubble / 2,
    0,
    Math.max(0, widths.track - widths.bubble),
  );
  const tailCentre = clamp(
    thumbCentre,
    bubbleLeft + TAIL_INSET_PX,
    Math.max(
      bubbleLeft + TAIL_INSET_PX,
      bubbleLeft + widths.bubble - TAIL_INSET_PX,
    ),
  );

  const commit = (next: number) => {
    if (!onChange) return;
    if (field.allowDecimals && field.decimalPlaces !== undefined) {
      const factor = Math.pow(10, field.decimalPlaces);
      onChange(Math.round(next * factor) / factor);
      return;
    }
    onChange(next);
  };

  /** Clamp to the range and onto the step grid, which is anchored at `min`. */
  const snap = (raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    if (typeof step !== "number" || step <= 0) return clamped;
    return Math.min(max, min + Math.round((clamped - min) / step) * step);
  };

  // While unanswered the thumb parks at `min`, so a user whose answer *is* `min`
  // would move it nowhere and the input would never fire a change event. Any
  // interaction therefore records the position the thumb is already at.
  const answerOnFirstInteraction = () => {
    if (!answered && interactive) commit(position);
  };

  const startBubbleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: event.clientX, value: position };
    setDragging(true);
    answerOnFirstInteraction();
  };

  const moveBubbleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    if (travel <= 0) return;
    // Scaled to the thumb's own travel, so the bubble keeps pace with the
    // pointer rather than drifting away from it.
    const perPixel = (max - min) / travel;
    commit(snap(origin.value + (event.clientX - origin.x) * perPixel));
  };

  const endBubbleDrag = () => {
    dragOrigin.current = null;
    setDragging(false);
  };

  const formatted = formatNumberFieldValue(field, position);
  const accentBorder = hasError
    ? "border-red-500"
    : answered
      ? "border-green"
      : "border-zinc-300";

  return (
    <div className="select-none">
      <div className="relative h-11">
        <div
          ref={bubbleRef}
          role="presentation"
          onPointerDown={startBubbleDrag}
          onPointerMove={moveBubbleDrag}
          onPointerUp={endBubbleDrag}
          onPointerCancel={endBubbleDrag}
          style={{ left: bubbleLeft }}
          className={cn(
            "absolute bottom-2.5 rounded-md border bg-white px-2 py-0.5 text-xl whitespace-nowrap tabular-nums shadow-sm",
            // `touch-none` so a horizontal drag adjusts the value instead of
            // scrolling or swiping the page.
            "touch-none",
            accentBorder,
            answered ? "text-zinc-900" : "text-zinc-400",
            interactive ? "cursor-ew-resize" : "cursor-not-allowed",
            dragging && "ring-2 ring-green/30",
          )}
        >
          {answered ? formatted : "—"}
        </div>
        <div
          style={{ left: tailCentre }}
          className={cn(
            // Sized and offset so its widest point sits on the bubble's bottom
            // edge, masking that border into a seamless tail.
            "absolute bottom-1 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b bg-white",
            accentBorder,
          )}
        />
      </div>
      <div ref={trackRef} className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-200" />
        {answered && (
          <div
            className={cn(
              "absolute h-1.5 rounded-full",
              hasError ? "bg-red-500" : "bg-green",
            )}
            style={{ width: `${fraction * 100}%` }}
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
          aria-valuetext={answered ? formatted : "No answer selected"}
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
      {/* Bare bounds: the template describes the answer, and a wordy one
          ("#{value}% of plastic recycled") reads as clutter on an axis. */}
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-zinc-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
