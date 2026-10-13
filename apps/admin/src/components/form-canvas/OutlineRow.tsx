import { cn } from "@alliance/shared/styles/util";
import { ChevronRight, GripVertical } from "lucide-react";
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

export type RowProps = {
  label: string;
  current: boolean;
  rangeFocus?: boolean;
  onSelect: () => void;
  /** Shift-click's selection through this row, in place of `onSelect`. */
  onExtend?: () => void;
  check?: { state: CheckState; onToggle: () => void };
  expanded?: boolean;
  onToggle?: () => void;
  /** At the entry or anywhere inside it. */
  issues?: number;
  className?: string;
};

export function OutlineRow({
  label,
  current,
  rangeFocus,
  onSelect,
  onExtend,
  check,
  expanded,
  onToggle,
  issues = 0,
  className,
  draggable = false,
}: RowProps & { draggable?: boolean }) {
  return (
    <div
      className={cn(
        "group/row flex items-center rounded-md",
        current ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100",
      )}
    >
      {draggable ? (
        <GripVertical
          className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-400 opacity-0 group-hover/row:opacity-100"
          aria-hidden="true"
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`Contents of ${label}`}
          title={expanded ? "Collapse" : "Expand"}
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <button
        type="button"
        {...extendableClick({ onSelect, onExtend })}
        aria-current={current}
        data-selection-focus={rangeFocus || undefined}
        title={label}
        className={cn(
          "min-w-0 flex-1 truncate rounded py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          !current && "text-gray-700",
          className,
        )}
      >
        {label}
      </button>
      <IssueMarker count={issues} className="mr-1" />
      {check && (
        <input
          type="checkbox"
          checked={CHECKBOX[check.state].checked}
          disabled={CHECKBOX[check.state].disabled}
          onChange={check.onToggle}
          aria-label={`Include ${label} in the selection`}
          title={CHECKBOX[check.state].title}
          className={cn(
            "mr-1 h-3.5 w-3.5 shrink-0",
            !CHECKBOX[check.state].checked &&
              "opacity-0 focus:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100",
          )}
        />
      )}
    </div>
  );
}
