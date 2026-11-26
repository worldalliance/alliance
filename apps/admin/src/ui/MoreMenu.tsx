import { Menu } from "@base-ui/react/menu";
import { ChevronDown, EllipsisVertical } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { type ButtonSize, ButtonVariant, buttonVariants } from "./Button";
import { cn } from "./cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import Spinner from "./Spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

export type MoreMenuItem = {
  /** Ends in "…" when it opens a dialog asking for more. */
  label: string;
  onSelect: () => void;
  /** Why it can't be used now; disables the item and shows under its label. */
  disabledReason?: string;
  destructive?: boolean;
  /**
   * A heading over this item and the ones after it with the same `group`,
   * which must be adjacent. Ignored on a destructive item.
   */
  group?: string;
};

type Run = { group: string | undefined; items: MoreMenuItem[] };

/** Adjacent items with one group; destructive items form the last run, after a separator. */
function runsOf(items: readonly MoreMenuItem[]): Run[] {
  const runs: Run[] = [];
  const ordered = [
    ...items.filter((i) => !i.destructive),
    ...items.filter((i) => i.destructive),
  ];
  for (const item of ordered) {
    const group = item.destructive ? undefined : item.group;
    const last = runs.at(-1);
    const same =
      last !== undefined &&
      last.group === group &&
      last.items[0]?.destructive === item.destructive;
    if (same) last.items.push(item);
    else runs.push({ group, items: [item] });
  }
  return runs;
}

/** The items of a `MoreMenu` or `ContextMenu`, inside a `DropdownMenuContent`. */
export function MoreMenuItems({ items }: { items: readonly MoreMenuItem[] }) {
  const base = useId();
  let index = 0;
  return runsOf(items).map((run, runIndex) => {
    const rows = run.items.map((item) => {
      const id = `${base}-${index++}`;
      const reason = item.disabledReason;
      return (
        <DropdownMenuItem
          key={item.label}
          label={item.label}
          disabled={reason !== undefined}
          onClick={item.onSelect}
          aria-labelledby={reason === undefined ? undefined : `${id}-label`}
          aria-describedby={reason === undefined ? undefined : `${id}-reason`}
          className={cn(
            item.destructive && "text-danger",
            reason !== undefined &&
              "flex-col items-start data-disabled:opacity-100",
          )}
        >
          {reason === undefined ? (
            item.label
          ) : (
            <>
              <span id={`${id}-label`} className="opacity-50">
                {item.label}
              </span>
              <span id={`${id}-reason`} className="text-caption text-fg-muted">
                {reason}
              </span>
            </>
          )}
        </DropdownMenuItem>
      );
    });
    return (
      <Fragment key={runIndex}>
        {runIndex > 0 && <DropdownMenuSeparator />}
        {run.group === undefined ? (
          rows
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{run.group}</DropdownMenuLabel>
            {rows}
          </DropdownMenuGroup>
        )}
      </Fragment>
    );
  });
}

/**
 * The "More" menu for a record header's or a row's remaining actions.
 * Destructive items go last, after a separator.
 */
export function MoreMenu({
  items,
  subject,
  size = "medium",
  busy = false,
  compact = false,
}: {
  items: readonly MoreMenuItem[];
  /** What the menu acts on, for its accessible name: "More: Sam Lee". Required in a row. */
  subject?: string;
  /** `small` in a table row. */
  size?: ButtonSize;
  /** An item's write is running: the trigger shows a spinner and doesn't open. */
  busy?: boolean;
  /** An icon-only trigger, for a row with little width to spare; its name shows as a tooltip. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // A prop-driven close fires no onOpenChange, so a menu hidden by `busy`
  // would reopen when the write ends.
  if (busy && open) setOpen(false);
  const name = subject === undefined ? "More" : `More: ${subject}`;
  const trigger = (
    <Menu.Trigger
      aria-label={compact || subject !== undefined ? name : undefined}
      {...(busy && { "aria-busy": true, "aria-disabled": true })}
      className={cn(
        "inline-flex",
        buttonVariants({ variant: ButtonVariant.Default, size }),
        compact && "aspect-square justify-center px-0",
      )}
    >
      {busy && <Spinner decorative size="small" />}
      {compact ? (
        !busy && (
          <EllipsisVertical
            aria-hidden="true"
            className="size-4 text-fg-muted"
          />
        )
      ) : (
        <>
          More
          <ChevronDown aria-hidden="true" className="size-4 text-fg-muted" />
        </>
      )}
    </Menu.Trigger>
  );
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next: boolean) => setOpen(next && !busy)}
    >
      {compact ? (
        <Tooltip disabled={open}>
          <TooltipTrigger render={trigger} />
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent align="end" className="min-w-48">
        <MoreMenuItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
