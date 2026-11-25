import { ChevronRight, type LucideIcon } from "lucide-react";
import type { DragEvent, MouseEvent } from "react";
import type { DropPosition } from "../../lib/useDragReorder";
import { cn } from "../../ui/cn";
import { IssueMarker } from "./IssueList";
import { CheckState, extendableClick } from "./rangeSelection";

const CHECKBOX: Record<
  CheckState,
  { checked: boolean; disabled: boolean; title: string }
> = {
  [CheckState.Unchecked]: {
    checked: false,
    disabled: false,
    title: "Include in the selection",
  },
  [CheckState.Checked]: {
    checked: true,
    disabled: false,
    title: "Remove from the selection",
  },
  [CheckState.Locked]: {
    checked: true,
    disabled: true,
    title: "Uncheck from an end of the selection",
  },
  [CheckState.NoId]: {
    checked: false,
    disabled: true,
    title: "A block without an ID can't be selected with others",
  },
  [CheckState.BesideNoId]: {
    checked: false,
    disabled: true,
    title: "The selected block has no ID, so nothing can be selected with it",
  },
};

const INDENT = ["pl-1", "pl-5", "pl-9", "pl-13", "pl-17", "pl-21"];

export type RowProps = {
  /** The row's accessible name, and its tooltip when truncated. */
  label: string;
  /** What the row shows, when shorter than `label`. */
  text?: string;
  icon?: LucideIcon;
  /** 1 for a page, deeper for what it holds. */
  level: number;
  /** The selection's own row. */
  current: boolean;
  /** In the selection: the current row, or a member of a range. */
  selected?: boolean;
  rangeFocus?: boolean;
  onSelect: () => void;
  /** Shift-click's selection through this row, in place of `onSelect`. */
  onExtend?: () => void;
  check?: { state: CheckState; onToggle: () => void };
  expanded?: boolean;
  onToggle?: () => void;
  /** Collapsed over the selection. */
  containsSelection?: boolean;
  /** At the entry or anywhere inside it. */
  issues?: number;
  /** The open page's row. */
  emphasis?: boolean;
};

export type RowDrag = {
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  /** Takes the drop whole, so it shows a ring for a drop line. */
  ringed: boolean;
};

const stop = (event: MouseEvent) => event.stopPropagation();

/**
 * One line of the outline tree. The tree owns the keys: arrows move focus
 * and the selection with it, so the row's own controls are pointer-only.
 */
export function OutlineRow({
  label,
  text = label,
  icon: Icon,
  level,
  current,
  selected = current,
  rangeFocus,
  onSelect,
  onExtend,
  check,
  expanded,
  onToggle,
  containsSelection = false,
  issues = 0,
  emphasis = false,
  rowKey,
  tabStop,
  drag,
}: RowProps & { rowKey: string; tabStop: boolean; drag?: RowDrag }) {
  return (
    <div
      role="treeitem"
      aria-label={label}
      aria-level={level}
      aria-selected={selected}
      aria-current={current}
      aria-expanded={onToggle ? expanded : undefined}
      aria-description={
        containsSelection ? "Contains the selection" : undefined
      }
      data-row-key={rowKey}
      data-selection-focus={rangeFocus || undefined}
      tabIndex={tabStop ? 0 : -1}
      draggable={drag !== undefined}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      {...extendableClick({ onSelect, onExtend })}
      className={cn(
        "relative flex h-8 cursor-default select-none items-center gap-1.5 rounded-md pr-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        INDENT[level - 1] ?? INDENT.at(-1),
        selected ? "bg-accent-soft text-fg" : "text-fg hover:bg-surface-2",
        emphasis && "font-medium",
        drag?.ringed && "ring-2 ring-inset ring-accent",
        "group/row",
      )}
    >
      {containsSelection && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
        />
      )}
      <span
        aria-hidden="true"
        data-toggle={onToggle ? "" : undefined}
        onClick={
          onToggle &&
          ((event) => {
            event.stopPropagation();
            onToggle();
          })
        }
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm text-fg-muted",
          onToggle && "hover:bg-surface-2 hover:text-fg",
        )}
      >
        {onToggle && (
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-fast ease-standard",
              expanded && "rotate-90",
            )}
          />
        )}
      </span>
      {Icon && (
        <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      )}
      <span className="min-w-0 flex-1 truncate" title={label}>
        {text}
      </span>
      <IssueMarker count={issues} className="shrink-0" />
      {check && (
        <input
          type="checkbox"
          aria-hidden="true"
          tabIndex={-1}
          checked={CHECKBOX[check.state].checked}
          disabled={CHECKBOX[check.state].disabled}
          onChange={check.onToggle}
          onClick={stop}
          onMouseDown={(event) => event.preventDefault()}
          aria-label={`Include ${label} in the selection`}
          title={CHECKBOX[check.state].title}
          className={cn(
            "size-3.5 shrink-0 accent-accent",
            !CHECKBOX[check.state].checked &&
              "opacity-0 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        />
      )}
    </div>
  );
}

/** A row and what it holds, as the tree renders it. */
export type OutlineEntry = {
  key: string;
  row: RowProps;
  drag?: RowDrag;
  /** Takes dragover anywhere in the entry, its contents included. */
  overEntry?: (event: DragEvent) => void;
  dropLine?: DropPosition | null;
  dragging?: boolean;
  /** Classes for the grey band behind a grey box's members. */
  band?: string;
  /** A note in place of contents, as "No elements"; it takes drops on the row. */
  empty?: { text: string; onDragOver?: (event: DragEvent) => void };
  children: OutlineEntry[];
};
