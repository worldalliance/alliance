import {
  filterOptionSections,
  type OptionSection,
} from "@alliance/shared/forms/optionSections";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { Check } from "lucide-react";
import { useMemo, useRef } from "react";
import { zIndex } from "../ui/zIndex";
import { DropdownIcons, dropdownIconsPadding } from "./ClearSelection";
import {
  ComboboxSection,
  itemClassName,
  listClassName,
  OptionSearch,
  popupClassName,
  triggerProps,
  useOptionSearch,
} from "./optionPicker";

type Option = { label: string; value: string; category?: string };

type Props = {
  sections: OptionSection<Option>[];
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  labelId?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

export default function SearchableSelect({
  sections,
  value,
  onChange,
  onClear,
  labelId,
  required,
  disabled,
  invalid,
  className,
}: Props) {
  const search = useOptionSearch();
  const filtered = useMemo(
    () =>
      filterOptionSections(sections, {
        query: search.query,
        text: (option) => option.label,
      }),
    [sections, search.query],
  );
  const selected =
    sections
      .flatMap((section) => section.items)
      .find((option) => option.value === value) ?? null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const clear =
    onClear && value
      ? () => {
          onClear();
          triggerRef.current?.focus();
        }
      : undefined;
  return (
    <div className="relative">
      <Combobox.Root<Option>
        items={sections}
        filteredItems={filtered}
        value={selected}
        onValueChange={(option) => {
          if (option) onChange?.(option.value);
        }}
        {...search.rootProps}
        disabled={disabled}
      >
        <Combobox.Trigger
          ref={triggerRef}
          {...triggerProps({
            labelId,
            required,
            invalid,
            className: cn(
              className,
              dropdownIconsPadding,
              "data-placeholder:text-zinc-400",
            ),
          })}
          onKeyDown={search.onTriggerKeyDown}
        >
          <span className="min-w-0 truncate">
            <Combobox.Value placeholder="Select an option" />
          </span>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} className={zIndex.popover}>
            <Combobox.Popup className={popupClassName}>
              <OptionSearch labelId={labelId} />
              <Combobox.List className={listClassName}>
                {(section: (typeof sections)[number]) => (
                  <ComboboxSection
                    key={section.category?.id ?? ""}
                    category={section.category}
                  >
                    {section.items.map((option) => (
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
                    ))}
                  </ComboboxSection>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <DropdownIcons onClear={clear} placeholder={!selected} />
    </div>
  );
}
