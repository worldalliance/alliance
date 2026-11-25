import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { type ButtonSize, ButtonVariant, buttonVariants } from "./Button";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent } from "./DropdownMenu";

export type CheckboxMenuItem = {
  value: string;
  label: string;
  /** A muted line under the label. */
  description?: string;
  checked: boolean;
  /** Its write is running: the item can't be toggled and says it's busy. */
  pending?: boolean;
};

/**
 * A menu of toggles that each take effect at once and leave it open, such as a
 * record's tags. Base UI's checkbox items give the roles and keys.
 */
export function CheckboxMenu({
  label,
  ariaLabel,
  title,
  items,
  onToggle,
  emptyText,
  size = "small",
}: {
  /** The trigger's text: "Edit tags". */
  label: string;
  /** The trigger's accessible name; start it with `label`: "Edit tags: Sam Lee". */
  ariaLabel: string;
  /** Heading inside the menu. */
  title: string;
  items: readonly CheckboxMenuItem[];
  /** `checked` is what the item should become. */
  onToggle: (value: string, checked: boolean) => void;
  /** Shown in place of the items when there are none. */
  emptyText: string;
  size?: ButtonSize;
}) {
  return (
    <DropdownMenu>
      <Menu.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex whitespace-nowrap",
          buttonVariants({ variant: ButtonVariant.Default, size }),
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-4 text-fg-muted" />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="max-h-80 w-80">
        <Menu.Group>
          <Menu.GroupLabel className="px-2 py-1 font-semibold">
            {title}
          </Menu.GroupLabel>
          {items.length === 0 && (
            <p className="px-2 py-2 text-fg-muted">{emptyText}</p>
          )}
          {items.map((item) => (
            <Menu.CheckboxItem
              key={item.value}
              checked={item.checked}
              disabled={item.pending}
              closeOnClick={false}
              label={item.label}
              onCheckedChange={(checked) => onToggle(item.value, checked)}
              {...(item.pending && { "aria-busy": true })}
              className="flex min-h-control-sm cursor-default items-start gap-2 rounded-sm px-2 py-1.5 outline-none select-none data-disabled:opacity-50 data-highlighted:bg-surface-2"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-line bg-surface data-checked:border-accent data-checked:bg-accent">
                <Menu.CheckboxItemIndicator keepMounted={false}>
                  <Check aria-hidden="true" className="size-3 text-accent-fg" />
                </Menu.CheckboxItemIndicator>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{item.label}</span>
                {item.description && (
                  <span className="truncate text-caption text-fg-muted">
                    {item.description}
                  </span>
                )}
              </span>
            </Menu.CheckboxItem>
          ))}
        </Menu.Group>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
