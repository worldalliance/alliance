import { Search, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useShortcutInShell } from "../../shell/shortcuts";
import Button, { ButtonVariant } from "../Button";
import { cn } from "../cn";
import { Input } from "../Input";
import { zIndex } from "../zIndex";

/**
 * The row under a List's header: search first, then filters and chips as
 * children, then the result count and list-wide actions on the right.
 */
export function FilterBar({
  children,
  count,
  actions,
}: {
  children?: ReactNode;
  /** "5 suites". Where the server pages, the total, not the page's rows. */
  count?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-page py-bar">
      {children}
      <div className="ml-auto flex items-center gap-3">
        {count !== undefined && (
          <span className="text-fg-muted tabular-nums" aria-live="polite">
            {count}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}

/** A list's search box. In the shell, `/` focuses it from outside a text field. */
export function SearchField({
  label,
  value,
  onChange,
  className,
}: {
  /** The accessible name and the placeholder: "Filter suites". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useShortcutInShell({
    keys: "/",
    label,
    run: () => ref.current?.focus(),
  });

  return (
    <div className={cn("relative w-60", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted"
      />
      <Input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-control-sm pl-8"
      />
    </div>
  );
}

/** An applied filter, naming its field and value, with a way to remove it. */
export function FilterChip({
  field,
  value,
  onRemove,
}: {
  field: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-control-sm items-center overflow-hidden rounded-md border border-line-strong bg-surface whitespace-nowrap">
      <span className="border-r border-line px-2 text-fg-muted">{field}</span>
      <span className="px-2 font-medium">{value}</span>
      <button
        type="button"
        aria-label={`Remove filter ${field}: ${value}`}
        onClick={onRemove}
        className="grid h-full place-items-center border-l border-line px-1.5 text-fg-muted focus-ring hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}

export type ViewOption<T extends string> = { id: T; label: string };

/** A switch between two views of the same items. Three or more views are tabs. */
export function ViewSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** The group's accessible name: "View". */
  label: string;
  options: readonly ViewOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-line-strong bg-surface-2 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className="h-7 rounded-sm px-2.5 font-medium text-fg-muted focus-ring hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-xs"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A List's body: the one region of the page that scrolls, so the table's
 * header sticks under the filter bar. Put a `ContentState` inside.
 */
export function ListContent({
  cards = false,
  children,
}: {
  /** The body is a stack of cards, not a table: padded, on the page background. */
  cards?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto",
        cards ? "flex flex-col gap-section px-page py-section" : "bg-surface",
      )}
    >
      {children}
    </div>
  );
}

/** Under a List's body: pagination, only where the data hook paginates. */
export function ListFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-page py-bar text-caption text-fg-muted">
      {children}
    </div>
  );
}

/**
 * Actions on the selected rows, as the last child of the page's body. It
 * floats over the foot of the main region, so appearing never moves the list.
 */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  /** Labelled buttons, one per action. */
  children: ReactNode;
}) {
  useEffect(() => {
    if (count === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClear();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [count, onClear]);

  if (count === 0) return null;
  return (
    // Zero height and stuck to the foot of the scrolling region: the bar hangs
    // above it without taking room in the flow.
    <div className={cn(zIndex.nav, "sticky bottom-0 h-0 shrink-0")}>
      <div
        role="group"
        aria-label="Actions on selected rows"
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-card bg-surface py-1.5 pr-1.5 pl-4 whitespace-nowrap shadow-pop"
      >
        <span className="mr-2 font-semibold tabular-nums" aria-live="polite">
          {count.toLocaleString("en-US")} selected
        </span>
        {children}
        <Button variant={ButtonVariant.Ghost} size="small" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
