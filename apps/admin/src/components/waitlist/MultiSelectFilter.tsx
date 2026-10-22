import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { MENU_TRIGGER_CLASS } from "./controlClasses";

type Option<T> = { value: T; label: string };

function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  /** Undefined until loaded, when no id reads as not found. */
  options: Option<T>[] | undefined;
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}) {
  const missing = options
    ? selected.filter(
        (value) => !options.some((option) => option.value === value),
      )
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
    <Menu.Root>
      <Menu.Trigger className={`${MENU_TRIGGER_CLASS} max-w-64`}>
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="truncate text-zinc-500">· {summary}</span>
        <ChevronDown size={14} className="shrink-0" />
      </Menu.Trigger>
      <DropdownMenuContent className="min-w-44 max-h-80 overflow-y-auto">
        {missing.length > 0 && (
          <DropdownMenuItem
            onClick={() =>
              onChange(selected.filter((value) => !missing.includes(value)))
            }
            className="text-amber-700"
          >
            Remove {missing.length} not found
          </DropdownMenuItem>
        )}
        {!options && (
          <p className="px-3 py-2 text-sm text-zinc-500">Not loaded</p>
        )}
        {options?.length === 0 && (
          <p className="px-3 py-2 text-sm text-zinc-500">None yet</p>
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
