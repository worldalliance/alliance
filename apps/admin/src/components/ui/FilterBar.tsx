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
  AnyOf = "any-of",
  Toggle = "toggle",
}

type FilterOption = {
  value: string;
  label: string;
  /** How many items the option matches, shown beside it in the popover. */
  count?: number;
};

type SetFilter<K extends FilterKind> = {
  kind: K;
  key: string;
  label: string;
  options: readonly FilterOption[];
  selected: ReadonlySet<string>;
  defaultSelected: ReadonlySet<string>;
  onChange: (selected: Set<string>) => void;
};

/** Narrows to the checked options; with every option checked it filters nothing. */
type OptionsFilter = SetFilter<FilterKind.Options>;

/** Narrows to items matching any checked option; with none checked it filters nothing. */
type AnyOfFilter = SetFilter<FilterKind.AnyOf>;

type ToggleFilter = {
  kind: FilterKind.Toggle;
  key: string;
  label: string;
  checked: boolean;
  defaultChecked: boolean;
  onChange: (checked: boolean) => void;
};

export type FilterDefinition = OptionsFilter | AnyOfFilter | ToggleFilter;

type Chip = { key: string; text: string; clear: () => void };

const chosenLabels = (filter: OptionsFilter | AnyOfFilter) =>
  filter.options
    .filter((option) => filter.selected.has(option.value))
    .map((option) => option.label)
    .join(", ");

const chipFor = (filter: FilterDefinition): Chip | null => {
  switch (filter.kind) {
    case FilterKind.Options:
      if (filter.options.every(({ value }) => filter.selected.has(value)))
        return null;
      return {
        key: filter.key,
        text: `${filter.label}: ${chosenLabels(filter) || "none"}`,
        clear: () =>
          filter.onChange(new Set(filter.options.map(({ value }) => value))),
      };
    case FilterKind.AnyOf: {
      if (filter.selected.size === 0) return null;
      const missing = [...filter.selected].filter(
        (value) => !filter.options.some((option) => option.value === value),
      );
      if (missing.length > 0)
        throw new Error(`${filter.key}: no option for ${missing.join(", ")}`);
      return {
        key: filter.key,
        text: `${filter.label}: ${chosenLabels(filter)}`,
        clear: () => filter.onChange(new Set()),
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

const isDefault = (filter: FilterDefinition): boolean => {
  switch (filter.kind) {
    case FilterKind.Options:
    case FilterKind.AnyOf:
      return (
        filter.selected.size === filter.defaultSelected.size &&
        [...filter.selected].every((value) => filter.defaultSelected.has(value))
      );
    case FilterKind.Toggle:
      return filter.checked === filter.defaultChecked;
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
};

const resetToDefault = (filter: FilterDefinition) => {
  switch (filter.kind) {
    case FilterKind.Options:
    case FilterKind.AnyOf:
      return filter.onChange(new Set(filter.defaultSelected));
    case FilterKind.Toggle:
      return filter.onChange(filter.defaultChecked);
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
};

const checkboxRow =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-800 hover:bg-zinc-50";

const SetControl = ({ filter }: { filter: OptionsFilter | AnyOfFilter }) => (
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
        <span className="flex-1">{option.label}</span>
        {option.count !== undefined && (
          <span className="tabular-nums text-xs text-zinc-500">
            <span className="sr-only">, </span>
            {option.count}
            <span className="sr-only"> matching</span>
          </span>
        )}
      </label>
    ))}
  </fieldset>
);

const FilterControl = ({ filter }: { filter: FilterDefinition }) => {
  switch (filter.kind) {
    case FilterKind.Options:
    case FilterKind.AnyOf:
      return <SetControl filter={filter} />;
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
 * A search box, a Filters popover, a chip per active filter, and Clear all
 * while the search or a chip shows and anything differs from its default. The
 * page owns the values.
 */
const FilterBar = ({ search, filters, ref }: FilterBarProps) => {
  const searchRef = useRef<HTMLInputElement>(null);
  // The page's value can lag behind typing, as a URL updated in a transition
  // does. Values the box sent are expected back in order and keep the draft;
  // any other value, such as one Back restored, replaces it. The page can skip
  // values, so reaching the last one sent forgets the rest, as sending the
  // page's own value does.
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
  const searching = draft !== "" || search.value !== "";
  const offerClearAll =
    searching || (chips.length > 0 && !filters.every(isDefault));
  const sendSearch = (value: string) => {
    setDraft(value);
    if (value === search.value) sent.current = [];
    else sent.current.push(value);
    search.onChange(value);
  };
  const clearAll = () => {
    if (searching) sendSearch("");
    filters.filter((filter) => !isDefault(filter)).forEach(resetToDefault);
    searchRef.current?.focus();
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
          ref={searchRef}
          type="search"
          value={draft}
          placeholder={search.label}
          onChange={(event) => sendSearch(event.target.value)}
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
            <Popover.Popup className="flex max-h-[var(--available-height)] min-w-56 flex-col gap-2 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2 shadow-lg outline-hidden">
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
      {offerClearAll && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md px-1.5 py-0.5 text-sm text-zinc-600 underline outline-hidden hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default FilterBar;
