import { DropdownMenuContent } from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";

type Option<T> = { value: T; label: string };

function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}) {
  const summary =
    options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label)
      .join(", ") || "Any";

  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm max-w-64 cursor-pointer hover:bg-zinc-50">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="truncate text-zinc-500">· {summary}</span>
        <ChevronDown size={14} className="shrink-0" />
      </Menu.Trigger>
      <DropdownMenuContent className="min-w-44 max-h-80 overflow-y-auto">
        {options.length === 0 && (
          <p className="px-3 py-2 text-sm text-zinc-500">None yet</p>
        )}
        {options.map((option) => (
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
            className="flex cursor-default select-none items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-zinc-100"
          >
            <span className="flex size-4 items-center justify-center rounded border border-zinc-300">
              <Menu.CheckboxItemIndicator>
                <Check size={12} />
              </Menu.CheckboxItemIndicator>
            </span>
            {option.label}
          </Menu.CheckboxItem>
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  );
}

export default MultiSelectFilter;
