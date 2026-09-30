import type { ActionCategory } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import {
  ACTION_CATEGORIES,
  ACTION_CATEGORY_DISPLAY,
  sortActionCategories,
} from "@alliance/sharedweb/lib/actionCategory";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";

export function ActionCategoryIcons({
  categories,
}: {
  categories: readonly ActionCategory[];
}) {
  if (categories.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-zinc-500">
      {sortActionCategories(categories).map((category) => {
        const { label, Icon } = ACTION_CATEGORY_DISPLAY[category];
        return (
          <Tooltip key={category}>
            <TooltipTrigger
              render={<span role="img" aria-label={label} />}
              className="inline-flex"
            >
              <Icon size={16} />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

export function ActionCategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: readonly ActionCategory[];
  onChange: (categories: ActionCategory[]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Categories" className="flex flex-row gap-1">
      {ACTION_CATEGORIES.map((category) => {
        const { label, Icon } = ACTION_CATEGORY_DISPLAY[category];
        const selected = value.includes(category);
        return (
          <Tooltip key={category}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      selected
                        ? value.filter((c) => c !== category)
                        : sortActionCategories([...value, category]),
                    )
                  }
                />
              }
              className={cn(
                "rounded border p-1.5 disabled:opacity-50",
                selected
                  ? "border-zinc-400 bg-zinc-100 text-zinc-900"
                  : "border-gray-2 bg-white text-zinc-300 hover:text-zinc-500",
              )}
            >
              <Icon size={14} />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
