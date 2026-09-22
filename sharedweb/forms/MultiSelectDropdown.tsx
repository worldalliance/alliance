import { matchesOptionSearch } from "@alliance/shared/forms/optionSearch";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, X } from "lucide-react";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { useMemo, useRef, useState } from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import { zIndex } from "../ui/zIndex";
import {
  itemClassName,
  listClassName,
  OptionSearch,
  popupClassName,
  triggerProps,
} from "./optionPicker";

type Option = { label: string; value: string };
type Item = Option & { text: string };

type Props = {
  options: Option[];
  value: string[];
  onChange?: (value: string[]) => void;
  searchable?: boolean;
  maxReached: boolean;
  labelId?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

const multiItemClassName = cn(
  "group",
  itemClassName,
  "outline-none data-disabled:cursor-default data-disabled:opacity-50",
);

function ItemContent({ label }: { label: string }) {
  return (
    <>
      <span className="min-w-0 break-words">
        <FormMarkdownWrapper markdownContent={label} inline />
      </span>
      <Check
        size={16}
        className="shrink-0 text-green invisible group-data-selected:visible"
      />
    </>
  );
}

export default function MultiSelectDropdown({
  options,
  value,
  onChange,
  searchable,
  maxReached,
  labelId,
  required,
  disabled,
  invalid,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        text: toString(fromMarkdown(option.label)),
      })),
    [options],
  );
  const selected = items.filter((item) => value.includes(item.value));
  const isOptionDisabled = (option: Option) =>
    maxReached && !value.includes(option.value);

  const trigger = {
    ref: triggerRef,
    ...triggerProps({
      labelId,
      required,
      invalid,
      className: cn(className, selected.length === 0 && "text-zinc-400"),
    }),
    children: (
      <>
        <span className="min-w-0 truncate">
          {selected.length > 0
            ? `${selected.length} selected`
            : "Select options…"}
        </span>
        <ChevronDown size={18} className="shrink-0" />
      </>
    ),
  };

  const picker = searchable ? (
    <Combobox.Root<Item, true>
      multiple
      items={items}
      value={selected}
      onValueChange={(next) => onChange?.(next.map((option) => option.value))}
      inputValue={query}
      onInputValueChange={(next, details) => {
        if (details.reason !== "input-clear") setQuery(next);
      }}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
      autoHighlight
      filter={(item, search) =>
        matchesOptionSearch({ label: item.text }, search)
      }
      disabled={disabled}
    >
      <Combobox.Trigger
        {...trigger}
        onKeyDown={(event) => {
          // Space keeps opening the picker; other printable keys start the search.
          if (
            event.key.length !== 1 ||
            event.key === " " ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setQuery(event.key);
          setOpen(true);
        }}
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className={zIndex.popover}>
          <Combobox.Popup className={popupClassName}>
            <OptionSearch labelId={labelId} />
            <Combobox.List className={listClassName}>
              {(option: Item) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  disabled={isOptionDisabled(option)}
                  className={multiItemClassName}
                >
                  <ItemContent label={option.label} />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  ) : (
    <Select.Root<string, true>
      multiple
      value={value}
      onValueChange={(next) => onChange?.(next)}
      disabled={disabled}
    >
      <Select.Trigger {...trigger} />
      <Select.Portal>
        <Select.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className={zIndex.popover}
        >
          <Select.Popup className={popupClassName}>
            <Select.List className={listClassName}>
              {items.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={option.text}
                  disabled={isOptionDisabled(option)}
                  className={multiItemClassName}
                >
                  <ItemContent label={option.label} />
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );

  return (
    <div className="space-y-2">
      {picker}
      {selected.length > 0 && (
        <ul aria-label="Selected options" className="flex flex-wrap gap-2">
          {selected.map((option) => (
            <li
              key={option.value}
              className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800"
            >
              <span className="min-w-0 break-words">
                <FormMarkdownWrapper markdownContent={option.label} inline />
              </span>
              {!disabled && onChange && (
                <button
                  type="button"
                  aria-label={`Remove ${option.text}`}
                  onClick={(event) => {
                    const chip = event.currentTarget.closest("li");
                    const neighbor = (
                      chip?.nextElementSibling ?? chip?.previousElementSibling
                    )?.querySelector("button");
                    (neighbor ?? triggerRef.current)?.focus();
                    onChange(value.filter((v) => v !== option.value));
                  }}
                  className="-mr-1 shrink-0 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
