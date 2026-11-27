import { Autocomplete } from "@base-ui/react/autocomplete";
import { type LucideIcon, Search } from "lucide-react";
import { cn } from "./cn";
import {
  OptionText,
  optionClass,
  optionGroupLabelClass,
  optionMatches,
} from "./option";

export type CommandItem = {
  /** Unique across every group; what `onPick` receives. */
  id: string;
  label: string;
  detail?: string;
  icon?: LucideIcon;
};

export type CommandGroup = { label: string; items: readonly CommandItem[] };

type ListGroup = { value: string; items: readonly CommandItem[] };

/**
 * A search box over a grouped list of things to do, for a popover: typing
 * filters by label and detail, the arrow keys move, Enter or a click runs
 * `onPick` with the item's id. The list keeps its height while filtering.
 */
export function CommandList({
  label,
  placeholder = "Search",
  groups,
  onPick,
  emptyText = "No matches",
  className,
}: {
  /** The search box's accessible name: "Search elements". */
  label: string;
  placeholder?: string;
  groups: readonly CommandGroup[];
  onPick: (id: string) => void;
  emptyText?: string;
  className?: string;
}) {
  const items: ListGroup[] = groups.map((group) => ({
    value: group.label,
    items: group.items,
  }));
  return (
    <Autocomplete.Root
      items={items}
      open
      inline
      autoHighlight="always"
      keepHighlight
      itemToStringValue={(item: CommandItem) => item.label}
      filter={(item: CommandItem, query) => optionMatches(item, query)}
    >
      <div className={cn("flex w-80 flex-col", className)}>
        <div className="flex h-control items-center gap-2 border-b border-line px-2.5">
          <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <Autocomplete.Input
            autoFocus
            aria-label={label}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-muted"
          />
        </div>
        <div className="h-80 overflow-y-auto p-1">
          <Autocomplete.Empty className="px-2.5 py-2 text-fg-muted empty:hidden">
            {emptyText}
          </Autocomplete.Empty>
          <Autocomplete.List aria-label={label} className="outline-none">
            {(group: ListGroup) => (
              <Autocomplete.Group key={group.value} items={group.items}>
                <Autocomplete.GroupLabel className={optionGroupLabelClass}>
                  {group.value}
                </Autocomplete.GroupLabel>
                <Autocomplete.Collection>
                  {(item: CommandItem) => (
                    <Autocomplete.Item
                      key={item.id}
                      value={item}
                      onClick={() => onPick(item.id)}
                      className={optionClass}
                    >
                      {item.icon && (
                        <item.icon
                          className="size-4 shrink-0 text-fg-muted"
                          aria-hidden
                        />
                      )}
                      <OptionText label={item.label} detail={item.detail} />
                    </Autocomplete.Item>
                  )}
                </Autocomplete.Collection>
              </Autocomplete.Group>
            )}
          </Autocomplete.List>
        </div>
      </div>
    </Autocomplete.Root>
  );
}
