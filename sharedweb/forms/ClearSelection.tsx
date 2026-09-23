import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, X } from "lucide-react";

export function ClearSelectionButton({
  onClear,
  className,
}: {
  onClear: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn("text-xs text-zinc-600 hover:text-zinc-800", className)}
    >
      Clear selection
    </button>
  );
}

export const dropdownIconsPadding = "pr-16";

export function DropdownIcons({
  onClear,
  placeholder,
}: {
  onClear?: () => void;
  placeholder: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-y-0 right-3 flex items-center gap-0.5",
        placeholder && "text-zinc-400",
      )}
    >
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
          className="pointer-events-auto rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          <X size={16} />
        </button>
      )}
      <ChevronDown size={18} />
    </span>
  );
}
