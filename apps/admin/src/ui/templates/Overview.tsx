import { createContext, type ReactNode, useContext, useId } from "react";
import { cn } from "../cn";
import { DateField } from "../DateField";
import { Input } from "../Input";
import { Field } from "./Form";

/** A `Panel` under a `Section`'s `h2` titles itself with an `h3`. */
const InSectionContext = createContext(false);

/** A group of cards on an Overview, under a muted label. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  /** A link to the List holding the full data, or a control for the section. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-control-sm items-center justify-between gap-3">
        <h2 className="text-caption font-medium text-fg-muted">{title}</h2>
        {action}
      </div>
      <InSectionContext value={true}>{children}</InSectionContext>
    </section>
  );
}

/** Twelve columns. Children take their share with `col-span-*`. */
export function OverviewGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-12 gap-section">{children}</div>;
}

/**
 * A card with a header row: a table, a chart or a list with its title. `flush`
 * drops the body's padding for a table or a row list.
 */
export function Panel({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: {
  title: string;
  /** Muted, beside the title. */
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  /** For `col-span-*` in an `OverviewGrid`. */
  className?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const Title = useContext(InSectionContext) ? "h3" : "h2";
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-line px-card py-2">
        <Title id={titleId} className="text-heading font-semibold">
          {title}
        </Title>
        {description && (
          <span className="text-caption text-fg-muted">{description}</span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className={cn("min-w-0", flush ? "overflow-x-auto" : "p-card")}>
        {children}
      </div>
    </section>
  );
}

/** A label and a number the server provides. No deltas or sparklines. */
export function StatTile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  /** Formatted; "—" when the server has no value. */
  value: string;
  /** Its line is held when there is none, so tiles in a row match and a note arriving moves nothing. */
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-card border border-line bg-surface p-card",
        className,
      )}
    >
      <span className="text-caption font-medium text-fg-muted">{label}</span>
      <span className="mt-1.5 text-stat font-semibold tabular-nums">
        {value}
      </span>
      <span className="min-h-lh text-caption text-fg-muted">{note}</span>
    </div>
  );
}

/**
 * The controls of a panel, first in its body, above what they drive. Fields
 * sit side by side; `actions` (an apply button, quick ranges, a checkbox) sit
 * after them, level with the fields' controls whether or not an error shows
 * under one.
 */
export function PanelControls({
  actions,
  children,
}: {
  actions?: ReactNode;
  /** `Field`s, `DateRangeFields`, `NumberField`s. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {children}
      {actions && (
        <div className="flex flex-col gap-1.5">
          <span aria-hidden="true" className="invisible">
            &nbsp;
          </span>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
    </div>
  );
}

/** A panel's body when it has controls: the controls, then what they drive. */
export function PanelStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** A muted line where a panel's content would be: nothing asked for yet, or nothing in one part. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-fg-muted">{children}</p>;
}

/** A number with its label inside a `Panel`, where a `StatTile` would be a card in a card. */
export function PanelStat({
  label,
  value,
  note,
}: {
  label: string;
  /** Formatted; "—" when the server has no value. */
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

export type DateRange = { start: string; end: string };

/** A From and a To date for a panel's range, as `yyyy-mm-dd`. Not for an instant members experience. */
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
  // A fixed width, so an error under a field wraps instead of pushing the next control aside.
  const date = (
    key: keyof DateRange,
    label: string,
    fieldError?: string | null,
  ) => (
    <Field label={label} error={fieldError} className="w-40">
      {(control) => (
        <DateField
          {...control}
          className="h-control-sm"
          value={range[key]}
          onChange={(value) => onChange({ ...range, [key]: value })}
        />
      )}
    </Field>
  );
  return (
    <>
      {date("start", startLabel, error)}
      {date("end", endLabel)}
    </>
  );
}

/** A whole number for a panel's control: weeks, days. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  help,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  help?: ReactNode;
  error?: string | null;
  placeholder?: string;
}) {
  return (
    <Field label={label} help={help} error={error} className="w-40">
      {(control) => (
        <Input
          {...control}
          type="number"
          inputMode="numeric"
          min={min}
          step={1}
          placeholder={placeholder}
          className="h-control-sm w-24"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
