import type { ReactNode } from "react";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import { popupClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { zIndex } from "../../ui/zIndex";
import type { DateRange } from "./homeRules";

/** Token colours for SVG marks, which take a colour value and not a class. */
export const chartColor = {
  grid: "var(--color-line)",
  cursor: "var(--color-fg-muted)",
  track: "var(--color-line-strong)",
  completed: "var(--color-success)",
  churned: "var(--color-danger)",
  withdrawn: "var(--color-warning)",
  inProgress: "var(--color-info)",
  inProgressSoft: "var(--color-info-soft)",
  primary: "var(--color-accent)",
  email: "var(--color-cat-1)",
  text: "var(--color-cat-3)",
} as const;

export const axisTextClass = "fill-fg-muted text-xs";

/** The controls of a panel, above what they drive. */
export function PanelControls({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>;
}

/**
 * A button beside fields in `PanelControls`: the blank line stands where a
 * field's label is, so the button sits level with the controls whether or not
 * an error shows under one.
 */
export function ControlSlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="invisible">
        &nbsp;
      </span>
      {children}
    </div>
  );
}

/** The body of a panel that has controls: the controls, then what they drive. */
export function PanelStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

export function DateRangeFields({
  range,
  onChange,
  startLabel = "From",
  endLabel = "To",
  error,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  startLabel?: string;
  endLabel?: string;
  /** What is wrong with the range as a whole, shown under its start. */
  error?: string | null;
}) {
  return (
    <>
      <Field label={startLabel} error={error}>
        {(control) => (
          <Input
            {...control}
            type="date"
            className="h-control-sm w-40"
            value={range.start}
            onChange={(event) =>
              onChange({ ...range, start: event.target.value })
            }
          />
        )}
      </Field>
      <Field label={endLabel}>
        {(control) => (
          <Input
            {...control}
            type="date"
            className="h-control-sm w-40"
            value={range.end}
            onChange={(event) =>
              onChange({ ...range, end: event.target.value })
            }
          />
        )}
      </Field>
    </>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  error?: string | null;
  placeholder?: string;
}) {
  return (
    <Field label={label} error={error}>
      {(control) => (
        <Input
          {...control}
          type="number"
          min={min}
          step={1}
          placeholder={placeholder}
          className="h-control-sm w-40"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** A muted line where a panel's content would be: nothing in range, or nothing asked for yet. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-fg-muted">{children}</p>;
}

/** A number with its label, inside a panel. Divided from its siblings by the grid's gap, not a card. */
export function PanelStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-caption font-medium text-fg-muted">{label}</span>
      <span className="mt-1 text-title font-semibold tabular-nums">
        {value}
      </span>
      {note && <span className="text-caption text-fg-muted">{note}</span>}
    </div>
  );
}

export function ChartLegend({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-caption text-fg-muted">
      {children}
    </ul>
  );
}

export function LegendItem({
  swatch,
  children,
}: {
  /** A colour value, or the swatch itself when it is a pattern. */
  swatch: string | ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      {typeof swatch === "string" ? (
        <span
          aria-hidden="true"
          className="size-3 rounded-sm"
          style={{ backgroundColor: swatch }}
        />
      ) : (
        swatch
      )}
      {children}
    </li>
  );
}

/** What the pointer is over, floating in the chart. Its parent is `relative`. */
export function ChartTip({
  title,
  className,
  style,
  children,
}: {
  title: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        popupClass,
        zIndex.raised,
        "pointer-events-none absolute w-64 p-3 text-caption",
        className,
      )}
      style={style}
    >
      <p className="mb-1.5 font-semibold text-fg">{title}</p>
      <dl className="flex flex-col gap-1">{children}</dl>
    </div>
  );
}

export function TipRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}
