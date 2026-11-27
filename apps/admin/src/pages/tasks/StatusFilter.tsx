import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ActionStatusBucket,
} from "../../lib/actionStatusBucket";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";

const BUCKETS = Object.values(ActionStatusBucket);

const summaryOf = (selected: ReadonlySet<ActionStatusBucket>) =>
  selected.size === BUCKETS.length
    ? "All"
    : BUCKETS.filter((bucket) => selected.has(bucket))
        .map((bucket) => ACTION_STATUS_BUCKET_LABELS[bucket])
        .join(", ") || "None";

export function StatusFilter({
  selected,
  onChange,
}: {
  selected: ReadonlySet<ActionStatusBucket>;
  onChange: (selected: Set<ActionStatusBucket>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex max-w-80",
          buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
        )}
      >
        <span>Status</span>
        <span className="truncate font-normal text-fg-muted">
          · {summaryOf(selected)}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44">
        {BUCKETS.map((bucket) => (
          <Menu.CheckboxItem
            key={bucket}
            checked={selected.has(bucket)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(bucket);
              else next.delete(bucket);
              onChange(next);
            }}
            className="flex min-h-control-sm cursor-default items-center gap-2 rounded-sm px-2 py-1 outline-none select-none data-highlighted:bg-surface-2"
          >
            <span className="grid size-4 place-items-center rounded-sm border border-line-control bg-surface">
              <Menu.CheckboxItemIndicator>
                <Check aria-hidden="true" className="size-3" />
              </Menu.CheckboxItemIndicator>
            </span>
            {ACTION_STATUS_BUCKET_LABELS[bucket]}
          </Menu.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
