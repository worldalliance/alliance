import { DropdownMenuContent } from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { ACTION_CATEGORY_LABELS, ActionCategory } from "../lib/actionCategory";

const ActionCategoryFilter = ({
  selected,
  onChange,
}: {
  selected: ReadonlySet<ActionCategory>;
  onChange: (selected: Set<ActionCategory>) => void;
}) => {
  const categories = Object.values(ActionCategory);
  const summary =
    selected.size === categories.length
      ? "All"
      : categories
          .filter((category) => selected.has(category))
          .map((category) => ACTION_CATEGORY_LABELS[category])
          .join(", ") || "None";

  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-full min-w-0 flex-1 items-center gap-x-1 pl-4 text-left cursor-pointer hover:bg-zinc-100">
        <span className="font-medium text-zinc-700">Actions</span>
        <span className="truncate text-zinc-500">· {summary}</span>
        <ChevronDown size={14} className="shrink-0" />
      </Menu.Trigger>
      <DropdownMenuContent className="min-w-44">
        {categories.map((category) => (
          <Menu.CheckboxItem
            key={category}
            checked={selected.has(category)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) {
                next.add(category);
              } else {
                next.delete(category);
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
            {ACTION_CATEGORY_LABELS[category]}
          </Menu.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  );
};

export default ActionCategoryFilter;
