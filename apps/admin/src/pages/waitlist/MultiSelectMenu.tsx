import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";

type Option<T> = { value: T; label: string };

/** A small Default button, for a menu's trigger. */
export const menuTriggerClass = cn(
  "inline-flex",
  buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
);

/**
 * A filter that matches any of several values, as a menu of checkboxes. Its
 * trigger reads "Organization · Acme, Bolt".
 */
export function MultiSelectMenu<T extends string | number>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  /** Undefined until loaded: a selected value then counts as unknown, not missing. */
  options: Option<T>[] | undefined;
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}) {
  const missing = options
    ? selected.filter((value) => !options.some((o) => o.value === value))
    : [];
  const summary = options
    ? [
        ...options
          .filter((option) => selected.includes(option.value))
          .map((option) => option.label),
        ...(missing.length ? [`${missing.length} not found`] : []),
      ].join(", ") || "Any"
    : selected.length
      ? `${selected.length} selected`
      : "Any";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(menuTriggerClass, "max-w-64")}>
        <span className="shrink-0">{label} ·</span>
        <span
          className={cn(
            "truncate",
            selected.length ? "font-semibold" : "font-normal text-fg-muted",
          )}
        >
          {summary}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 min-w-48">
        {missing.length > 0 && (
          <>
            <DropdownMenuItem
              onClick={() =>
                onChange(selected.filter((value) => !missing.includes(value)))
              }
            >
              Remove {missing.length} not found
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!options && <p className="px-2 py-1.5 text-fg-muted">Not loaded</p>}
        {options?.length === 0 && (
          <p className="px-2 py-1.5 text-fg-muted">None yet</p>
        )}
        {options?.map((option) => (
          <Menu.CheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            closeOnClick={false}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value),
              )
            }
            className="flex min-h-control-sm cursor-default items-center gap-2 rounded-sm px-2 py-1 outline-none select-none data-highlighted:bg-surface-2"
          >
            <span className="grid size-4 shrink-0 place-items-center rounded-sm border border-line-control bg-surface">
              <Menu.CheckboxItemIndicator>
                <Check aria-hidden="true" className="size-3 text-accent" />
              </Menu.CheckboxItemIndicator>
            </span>
            {option.label}
          </Menu.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
