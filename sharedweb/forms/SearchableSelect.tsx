import { matchesOptionSearch } from "@alliance/shared/forms/optionSearch";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { zIndex } from "../ui/zIndex";

type Option = { label: string; value: string };

type Props = {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  labelId?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  labelId,
  required,
  disabled,
  invalid,
  className,
}: Props) {
  return (
    <Combobox.Root<Option>
      items={options}
      value={options.find((option) => option.value === value) ?? null}
      onValueChange={(option) => {
        if (option) onChange?.(option.value);
      }}
      filter={matchesOptionSearch}
      disabled={disabled}
    >
      <Combobox.Trigger
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : "Options"}
        aria-required={required}
        aria-invalid={invalid}
        className={cn(
          className,
          "flex w-full items-center justify-between gap-2 text-left disabled:cursor-default! data-placeholder:text-zinc-400",
        )}
      >
        <span className="min-w-0 truncate">
          <Combobox.Value placeholder="Select an option" />
        </span>
        <ChevronDown size={18} className="shrink-0" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className={zIndex.popover}>
          <Combobox.Popup className="flex flex-col w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-hidden rounded border border-zinc-300 bg-white shadow-lg">
            <div className="border-b border-zinc-200 p-2">
              <Combobox.Input
                aria-label="Search options"
                aria-describedby={labelId}
                placeholder="Search options…"
                className="w-full rounded px-3 py-2 text-base outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <Combobox.Empty className="px-3 py-2 text-zinc-500 empty:p-0">
              No matches
            </Combobox.Empty>
            <Combobox.List className="min-h-0 max-h-72 overflow-y-auto overscroll-contain">
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-zinc-900 data-highlighted:bg-zinc-100"
                >
                  {option.label}
                  <Combobox.ItemIndicator>
                    <Check size={16} className="text-green" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
