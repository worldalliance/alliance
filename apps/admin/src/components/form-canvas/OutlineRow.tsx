import { cn } from "@alliance/shared/styles/util";
import { ChevronRight, GripVertical } from "lucide-react";

export type RowProps = {
  label: string;
  current: boolean;
  onSelect: () => void;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
};

export function OutlineRow({
  label,
  current,
  onSelect,
  expanded,
  onToggle,
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
        onClick={onSelect}
        aria-current={current}
        title={label}
        className={cn(
          "min-w-0 flex-1 truncate rounded py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          !current && "text-gray-700",
          className,
        )}
      >
        {label}
      </button>
    </div>
  );
}
