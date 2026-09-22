import { matchesOptionSearch } from "@alliance/shared/forms/optionSearch";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { zIndex } from "../ui/zIndex";
import {
  itemClassName,
  listClassName,
  OptionSearch,
  popupClassName,
  triggerProps,
} from "./optionPicker";

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
        {...triggerProps({
          labelId,
          required,
          invalid,
          className: cn(className, "data-placeholder:text-zinc-400"),
        })}
      >
        <span className="min-w-0 truncate">
          <Combobox.Value placeholder="Select an option" />
        </span>
        <ChevronDown size={18} className="shrink-0" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className={zIndex.popover}>
          <Combobox.Popup className={popupClassName}>
            <OptionSearch labelId={labelId} />
            <Combobox.List className={listClassName}>
              {(option: Option) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className={itemClassName}
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
