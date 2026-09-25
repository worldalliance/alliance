import { DropdownMenuContent } from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ActionStatusBucket,
} from "../lib/actionStatusBucket";

const ActionStatusBucketFilter = ({
  selected,
  onChange,
}: {
  selected: ReadonlySet<ActionStatusBucket>;
  onChange: (selected: Set<ActionStatusBucket>) => void;
}) => {
  const buckets = Object.values(ActionStatusBucket);
  const summary =
    selected.size === buckets.length
      ? "All"
      : buckets
          .filter((bucket) => selected.has(bucket))
          .map((bucket) => ACTION_STATUS_BUCKET_LABELS[bucket])
          .join(", ") || "None";

  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-full min-w-0 flex-1 items-center gap-x-1 pl-4 text-left cursor-pointer hover:bg-zinc-100">
        <span className="font-medium text-zinc-700">Actions</span>
        <span className="truncate text-zinc-500">· {summary}</span>
        <ChevronDown size={14} className="shrink-0" />
      </Menu.Trigger>
      <DropdownMenuContent className="min-w-44">
        {buckets.map((bucket) => (
          <Menu.CheckboxItem
            key={bucket}
            checked={selected.has(bucket)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) {
                next.add(bucket);
              } else {
                next.delete(bucket);
              }
              onChange(next);
            }}
            className="flex cursor-default select-none items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-zinc-100"
          >
            <span className="flex size-4 items-center justify-center rounded border border-zinc-300">
              <Menu.CheckboxItemIndicator>
                <Check size={12} />
              </Menu.CheckboxItemIndicator>
            </span>
            {ACTION_STATUS_BUCKET_LABELS[bucket]}
          </Menu.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  );
};

export default ActionStatusBucketFilter;
