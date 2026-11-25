import { Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useSearchParams } from "react-router";
import { countOf, formatCount } from "../../lib/formatNumber";
import { useShortcutInShell } from "../../shell/shortcuts";
import Button, { ButtonVariant } from "../Button";
import { cn } from "../cn";
import { Input } from "../Input";
import { zIndex } from "../zIndex";
import type { UrlTabs } from "./usePlaceTabs";

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
    // The minimum holds a full-height control, so the bar is one height on
    // every tab whatever it holds and the list under it never moves.
    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-line px-page py-bar">
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

/**
 * A list's search text, kept in `?q=`: `[q, setQ]` for `SearchField`. Typing
 * replaces the history entry, and the other params stay.
 */
export function useListSearch(): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const setQ = useCallback(
    (value: string) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set("q", value);
          else next.delete("q");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  return [searchParams.get("q") ?? "", setQ];
}

/**
 * `FilterBar`'s `count`: "12 groups", or "3 of 12 groups" when a search or
 * filter hides some. Nothing while the list is loading or has no items, where
 * the body already says so.
 */
export const listCount = ({
  shown,
  total,
  noun,
}: {
  /** Rows after search and filters. Omit for a list with neither. */
  shown?: number;
  /** Every item, or where the server pages, its total; undefined until loaded. */
  total: number | undefined;
  /** Singular: "group". */
  noun: string;
}): string | undefined => {
  if (!total) return undefined;
  return shown === undefined || shown === total
    ? countOf(total, noun)
    : `${formatCount(shown)} of ${countOf(total, noun)}`;
};

/**
 * A list's search box, one to a page: in the shell, `/` focuses it from
 * outside a text field, and a shortcut has one owner.
 */
export function SearchField({
  label,
  value,
  onChange,
  className,
  ref: outer,
}: {
  /** The accessible name and the placeholder: "Filter suites". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** For `useFocusAfterRemoval`'s fallback in a list with no add control. */
  ref?: Ref<{ focus: () => void }>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useImperativeHandle(outer, () => ({ focus: () => ref.current?.focus() }));
  useShortcutInShell({
    keys: "/",
    label,
    run: () => ref.current?.focus(),
  });
  // While the reader is in the box it shows their own text, not `value`: a
  // value kept in the URL comes back a render or more after each keystroke,
  // and a box bound to it drops the letters typed in between. Out of the box
  // it follows `value`, which Clear filters and Back change.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value);
  }, [value]);

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
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(next);
        }}
        onBlur={() => setDraft(value)}
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

/**
 * A switch between two views of the same items; spread `usePlaceViews` into
 * it. Three or more views are tabs.
 */
export function ViewSwitch<T extends string>({
  label,
  items,
  value,
  onChange,
}: UrlTabs<T> & {
  /** The group's accessible name: "View". */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-line-strong bg-surface-2 p-0.5"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === value}
          onClick={() => onChange(item.id)}
          className="h-7 rounded-sm px-2.5 font-medium text-fg-muted focus-ring hover:text-fg aria-pressed:bg-surface aria-pressed:text-fg aria-pressed:shadow-xs"
        >
          {item.label}
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
        // With no filter bar above it, the table would touch the page description.
        cards
          ? "flex flex-col gap-section px-page py-section"
          : "bg-surface first:mt-3",
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
          {formatCount(count)} selected
        </span>
        {children}
        <Button variant={ButtonVariant.Ghost} size="small" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
