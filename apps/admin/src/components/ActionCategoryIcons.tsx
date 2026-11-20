import type { ActionCategory } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";
import {
  Check,
  Cpu,
  HandCoins,
  Landmark,
  Leaf,
  Users,
  type LucideIcon,
} from "lucide-react";

const ACTION_CATEGORY_DISPLAY: Record<
  ActionCategory,
  { label: string; Icon: LucideIcon }
> = {
  environment: { label: "Environmental destruction", Icon: Leaf },
  poverty: { label: "Extreme poverty", Icon: HandCoins },
  democracy: { label: "Democratic institutional decline", Icon: Landmark },
  technology: { label: "Dangerous technological development", Icon: Cpu },
  meta: { label: "Meta", Icon: Users },
};

// Safe: the Record literal above has exactly the ActionCategory keys.
const ACTION_CATEGORIES = Object.keys(
  ACTION_CATEGORY_DISPLAY,
) as ActionCategory[];

const sortCategories = (categories: readonly ActionCategory[]) =>
  ACTION_CATEGORIES.filter((category) => categories.includes(category));

export function ActionCategoryIcons({
  categories,
}: {
  categories: readonly ActionCategory[];
}) {
  if (categories.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-zinc-500">
      {sortCategories(categories).map((category) => {
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
  showLabels = false,
}: {
  value: readonly ActionCategory[];
  onChange: (categories: ActionCategory[]) => void;
  disabled?: boolean;
  /** Names each category beside its icon rather than in a tooltip. */
  showLabels?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Categories"
      className="flex flex-row flex-wrap gap-1"
    >
      {ACTION_CATEGORIES.map((category) => {
        const { label, Icon } = ACTION_CATEGORY_DISPLAY[category];
        const selected = value.includes(category);
        const toggle = () =>
          onChange(
            selected
              ? value.filter((c) => c !== category)
              : sortCategories([...value, category]),
          );
        const className = cn(
          "rounded-md border p-1.5 disabled:opacity-50",
          selected
            ? "border-zinc-400 bg-zinc-100 text-zinc-900"
            : "border-zinc-300 bg-white text-zinc-300 hover:text-zinc-500",
        );
        if (showLabels) {
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={toggle}
              className={cn(
                className,
                "flex items-center gap-1.5 px-2 text-sm",
                !selected && "text-zinc-600 hover:text-zinc-900",
              )}
            >
              <Icon size={14} aria-hidden />
              {label}
              {selected && <Check size={14} aria-hidden />}
            </button>
          );
        }
        return (
          <Tooltip key={category}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={toggle}
                />
              }
              className={className}
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
