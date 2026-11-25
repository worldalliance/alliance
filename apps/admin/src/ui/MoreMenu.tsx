import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { Fragment, useState } from "react";
import { type ButtonSize, ButtonVariant, buttonVariants } from "./Button";
import { cn } from "./cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";

export type MoreMenuItem = {
  /** Ends in "…" when it opens a dialog asking for more. */
  label: string;
  onSelect: () => void;
  /** Why it can't be used now; disables the item and shows under its label. */
  disabledReason?: string;
  destructive?: boolean;
};

/**
 * The "More" menu for a record header's or a row's remaining actions.
 * Destructive items go last, after a separator.
 */
export function MoreMenu({
  items,
  subject,
  size = "medium",
  busy = false,
}: {
  items: readonly MoreMenuItem[];
  /** What the menu acts on, for its accessible name: "More: Sam Lee". Required in a row. */
  subject?: string;
  /** `small` in a table row. */
  size?: ButtonSize;
  /** An item's write is running: the trigger shows a spinner and doesn't open. */
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const firstDestructive = items.findIndex((item) => item.destructive);
  return (
    <DropdownMenu
      open={open && !busy}
      onOpenChange={(next: boolean) => setOpen(next && !busy)}
    >
      <Menu.Trigger
        aria-label={subject === undefined ? undefined : `More: ${subject}`}
        {...(busy && { "aria-busy": true, "aria-disabled": true })}
        className={cn(
          "inline-flex",
          buttonVariants({ variant: ButtonVariant.Default, size }),
        )}
      >
        {busy && (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        )}
        More
        <ChevronDown aria-hidden="true" className="size-4 text-fg-muted" />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index === firstDestructive && index > 0 && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              label={item.label}
              disabled={item.disabledReason !== undefined}
              onClick={item.onSelect}
              className={cn(
                item.destructive && "text-danger",
                item.disabledReason !== undefined &&
                  "flex-col items-start data-disabled:opacity-100",
              )}
            >
              {item.disabledReason === undefined ? (
                item.label
              ) : (
                <>
                  <span className="opacity-50">{item.label}</span>
                  <span className="text-caption text-fg-muted">
                    {item.disabledReason}
                  </span>
                </>
              )}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
