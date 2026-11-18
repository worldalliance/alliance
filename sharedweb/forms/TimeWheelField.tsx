import type { TimePickerField } from "@alliance/common/forms/form-schema";
import {
  timeWheelControls,
  timeWheelIndexAt,
  timeWheelLayout,
  type TimeWheelColumn,
} from "@alliance/shared/forms/timeWheel";
import { cn } from "@alliance/shared/styles/util";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  RenderLabel,
  useQuestionLabelId,
  ValidationMessage,
  type FieldInputProps,
} from "./fieldParts";

const LAYOUT = timeWheelLayout();
const SETTLE_MS = 120;

export function TimeWheelField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TimePickerField>) {
  const labelId = useQuestionLabelId(field);
  const locked = disabled || isOutputView || !onChange;
  const { columns, turn } = timeWheelControls({ value, onChange });

  return (
    <div className="space-y-1">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
        className="mb-4"
      />
      <div
        role="group"
        aria-labelledby={labelId}
        className="relative flex w-full justify-center rounded-2xl bg-zinc-100"
        style={{ height: LAYOUT.height }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 rounded-lg bg-zinc-200"
          style={{ top: LAYOUT.edge, height: LAYOUT.row }}
        />
        {columns.map((column) => (
          <WheelColumn
            key={column.key}
            column={column}
            disabled={locked}
            onSelect={(index) => turn(column.key, index)}
          />
        ))}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-t-2xl bg-gradient-to-b from-zinc-100 to-transparent"
          style={{ height: LAYOUT.fade }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-zinc-100 to-transparent"
          style={{ height: LAYOUT.fade }}
        />
      </div>
      <ValidationMessage message={errorMessage} />
    </div>
  );
}

const KEY_STEPS: Record<string, (index: number, last: number) => number> = {
  ArrowUp: (index) => index + 1,
  ArrowDown: (index) => index - 1,
  Home: () => 0,
  End: (_, last) => last,
};

function WheelColumn({
  column,
  disabled,
  onSelect,
}: {
  column: TimeWheelColumn;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const placed = useRef(false);
  const last = column.options.length - 1;
  const [centred, setCentred] = useState(column.index);

  useLayoutEffect(() => {
    const top = column.index * LAYOUT.row;
    const el = ref.current;
    if (!el) return;
    if (Math.abs(el.scrollTop - top) >= 1) {
      el.scrollTo({ top, behavior: placed.current ? "auto" : "instant" });
    }
    placed.current = true;
  }, [column.index]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  const select = (index: number) => {
    const next = Math.min(Math.max(index, 0), last);
    if (next !== column.index) onSelect(next);
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const centredAt = () =>
      timeWheelIndexAt({ offset: el.scrollTop, row: LAYOUT.row, last });
    setCentred(centredAt());
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => select(centredAt()), SETTLE_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (!step || disabled) return;
    event.preventDefault();
    select(step(column.index, last));
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={column.label}
      aria-valuenow={column.index}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuetext={column.options[column.index]}
      aria-disabled={disabled || undefined}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className={cn(
        "relative snap-y snap-mandatory overflow-y-scroll rounded-lg [scrollbar-width:none] motion-safe:scroll-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green [&::-webkit-scrollbar]:hidden",
        disabled && "pointer-events-none overflow-hidden",
      )}
      style={{ width: LAYOUT.column, paddingBlock: LAYOUT.edge }}
    >
      {column.options.map((option, index) => (
        <div
          key={option}
          aria-hidden
          onClick={() => select(index)}
          className={cn(
            "flex cursor-pointer snap-center items-center justify-center text-xl tabular-nums",
            index === centred ? "text-zinc-900" : "text-zinc-600",
          )}
          style={{ height: LAYOUT.row }}
        >
          {option}
        </div>
      ))}
    </div>
  );
}
