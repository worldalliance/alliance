import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { countOf } from "../../lib/formatNumber";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { cn } from "../../ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/Popover";

export type MultiFilterOption<T extends string> = {
  value: T;
  label: string;
  /** Members with it, or undefined while unknown. */
  memberCount: number | undefined;
};

/**
 * A filter matching any of several picked values, each with its member count:
 * "All tags", the one picked, or "2 tags" on the button.
 */
export function MultiFilter<T extends string>({
  title,
  noun,
  options,
  selected,
  onChange,
  emptyText,
  disabled = false,
}: {
  /** "Tags". */
  title: string;
  /** Singular: "tag". */
  noun: string;
  options: readonly MultiFilterOption<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  /** Shown in place of the options when there are none. */
  emptyText: string;
  disabled?: boolean;
}) {
  const legendId = useId();
  const picked = options.filter((option) => selected.includes(option.value));
  const summary =
    selected.length === 0
      ? `All ${title.toLowerCase()}`
      : selected.length === 1 && picked[0]
        ? picked[0].label
        : countOf(selected.length, noun);
  const toggle = (value: T) =>
    onChange(
      selected.includes(value)
        ? selected.filter((one) => one !== value)
        : [...selected, value],
    );
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`${title}: ${summary}`}
        className={cn(
          buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
          "inline-flex max-w-56 whitespace-nowrap",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="text-fg-muted">{title}</span>
        <span className="truncate">{summary}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-fg-muted" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1">
        <fieldset aria-labelledby={legendId}>
          <div className="flex items-center justify-between px-2 py-1">
            <span id={legendId} className="font-semibold">
              {title}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="rounded-sm px-1 text-accent focus-ring disabled:text-fg-muted"
            >
              Clear
            </button>
          </div>
          {options.length === 0 ? (
            <p className="px-2 py-2 text-fg-muted">{emptyText}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {options.map((option) => (
                <li key={option.value}>
                  <label className="flex min-h-control-sm cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-surface-2">
                    <Checkbox
                      checked={selected.includes(option.value)}
                      onChange={() => toggle(option.value)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <span className="text-caption text-fg-muted tabular-nums">
                      {option.memberCount === undefined
                        ? "—"
                        : countOf(option.memberCount, "member")}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
