import { cn } from "@alliance/shared/styles/util";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Popover } from "@base-ui/react/popover";
import { ListFilter, Search, X } from "lucide-react";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { inputClass, secondaryButtonClass } from "./controlStyles";

export enum FilterKind {
  Options = "options",
  Toggle = "toggle",
}

/** Narrows to the checked options; with every option checked it filters nothing. */
type OptionsFilter = {
  kind: FilterKind.Options;
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
  selected: ReadonlySet<string>;
  onChange: (selected: Set<string>) => void;
};

type ToggleFilter = {
  kind: FilterKind.Toggle;
  key: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export type FilterDefinition = OptionsFilter | ToggleFilter;

type Chip = { key: string; text: string; clear: () => void };

const chipFor = (filter: FilterDefinition): Chip | null => {
  switch (filter.kind) {
    case FilterKind.Options: {
      if (filter.options.every(({ value }) => filter.selected.has(value)))
        return null;
      const chosen = filter.options
        .filter((option) => filter.selected.has(option.value))
        .map((option) => option.label);
      return {
        key: filter.key,
        text: `${filter.label}: ${chosen.join(", ") || "none"}`,
        clear: () =>
          filter.onChange(new Set(filter.options.map(({ value }) => value))),
      };
    }
    case FilterKind.Toggle:
      return filter.checked
        ? {
            key: filter.key,
            text: filter.label,
            clear: () => filter.onChange(false),
          }
        : null;
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
};

const checkboxRow =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-50";

const FilterControl = ({ filter }: { filter: FilterDefinition }) => {
  switch (filter.kind) {
    case FilterKind.Options:
      return (
        <fieldset className="flex flex-col">
          <legend className="px-2 pb-1 text-xs font-medium text-zinc-500">
            {filter.label}
          </legend>
          {filter.options.map((option) => (
            <label key={option.value} className={checkboxRow}>
              <input
                type="checkbox"
                checked={filter.selected.has(option.value)}
                onChange={(event) => {
                  const next = new Set(filter.selected);
                  if (event.target.checked) next.add(option.value);
                  else next.delete(option.value);
                  filter.onChange(next);
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      );
    case FilterKind.Toggle:
      return (
        <label className={checkboxRow}>
          <input
            type="checkbox"
            checked={filter.checked}
            onChange={(event) => filter.onChange(event.target.checked)}
          />
          {filter.label}
        </label>
      );
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
};

export type FilterBarHandle = { focusChip: (key: string) => void };

type FilterBarProps = {
  search: { label: string; value: string; onChange: (value: string) => void };
  filters: FilterDefinition[];
  ref?: Ref<FilterBarHandle>;
};

/**
 * A search box, a Filters popover and a chip per active filter. The page owns
 * the values.
 */
const FilterBar = ({ search, filters, ref }: FilterBarProps) => {
  // The page's value can lag behind typing, as a URL updated in a transition
  // does. Values the box sent are expected back in order and keep the draft;
  // any other value, such as one Back restored, replaces it. The page can skip
  // values, so reaching the last one sent forgets the rest, as typing back to
  // the page's value does.
  const [draft, setDraft] = useState(search.value);
  const sent = useRef<string[]>([]);
  useEffect(() => {
    const index =
      sent.current.at(-1) === search.value
        ? sent.current.length - 1
        : sent.current.indexOf(search.value);
    if (index === -1) {
      sent.current = [];
      setDraft(search.value);
    } else sent.current = sent.current.slice(index + 1);
  }, [search.value]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  useImperativeHandle(ref, () => ({
    focusChip: (key) => {
      const button = removeButtons.current.get(key);
      if (!button) throw new Error(`no chip for filter ${key}`);
      button.focus();
    },
  }));
  const chips = filters.map(chipFor).filter((chip) => chip !== null);
  const removeChip = (index: number) => {
    chips[index].clear();
    const neighbour = chips[index + 1] ?? chips[index - 1];
    (neighbour
      ? removeButtons.current.get(neighbour.key)
      : triggerRef.current
    )?.focus();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex items-center">
        <span className="sr-only">{search.label}</span>
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-2 text-zinc-500"
        />
        <input
          type="search"
          value={draft}
          placeholder={search.label}
          onChange={(event) => {
            setDraft(event.target.value);
            if (event.target.value === search.value) sent.current = [];
            else sent.current.push(event.target.value);
            search.onChange(event.target.value);
          }}
          className={cn(inputClass, "w-64 pl-7")}
        />
      </label>
      <Popover.Root>
        <Popover.Trigger ref={triggerRef} className={secondaryButtonClass}>
          <ListFilter size={14} aria-hidden />
          Filters
          {chips.length > 0 && (
            <span className="rounded-md bg-zinc-100 px-1 text-xs tabular-nums text-zinc-700">
              {chips.length}
              <span className="sr-only"> active</span>
            </span>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            className={zIndex.popover}
            align="start"
            sideOffset={4}
          >
            <Popover.Popup className="flex min-w-56 flex-col gap-2 rounded-md border border-zinc-200 bg-white p-2 shadow-lg outline-hidden">
              <Popover.Title className="sr-only">Filters</Popover.Title>
              {filters.map((filter) => (
                <FilterControl key={filter.key} filter={filter} />
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap gap-1">
          {chips.map((chip, index) => (
            <li
              key={chip.key}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 py-0.5 pl-2 pr-0.5 text-sm text-zinc-800"
            >
              {chip.text}
              <button
                type="button"
                aria-label={`Remove filter: ${chip.text}`}
                title="Remove filter"
                ref={(button) => {
                  if (button) removeButtons.current.set(chip.key, button);
                  else removeButtons.current.delete(chip.key);
                }}
                onClick={() => removeChip(index)}
                className="flex size-6 items-center justify-center rounded-md text-zinc-500 outline-hidden hover:bg-zinc-200 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FilterBar;
