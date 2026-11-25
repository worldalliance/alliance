import { Combobox as Primitive } from "@base-ui/react/combobox";
import { ChevronDown, LoaderCircle } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { cn } from "./cn";
import { OptionText, optionClass, optionMatches } from "./option";
import { controlClass, popupClass } from "./styles";
import { zIndex } from "./zIndex";

export type ComboboxOption<V extends string | number> = {
  value: V;
  label: string;
  detail?: string | null;
};

type InputProps = Pick<
  React.ComponentProps<"input">,
  "id" | "aria-describedby" | "aria-invalid" | "aria-label" | "required"
>;

/**
 * A select whose list filters as the reader types: one value from a list too
 * long to scroll (tasks, members, respondents). Takes `Field`'s control props.
 * Passing `query` and `onQueryChange` turns off its own filtering, so
 * `options` can be a server search's results.
 */
export function Combobox<V extends string | number>({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "No matches",
  loading = false,
  loadError,
  query,
  onQueryChange,
  disabled,
  className,
  ...inputProps
}: InputProps & {
  options: readonly ComboboxOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  /** Said in the list in place of the options. */
  loadError?: string | null;
  query?: string;
  onQueryChange?: (query: string) => void;
  disabled?: boolean;
  /** The input's: `h-control-sm` for a small one. */
  className?: string;
}) {
  // A server search can drop the picked option from `options`; the input keeps its name.
  const picked = useRef<ComboboxOption<V> | null>(null);
  const found = options.find((option) => option.value === value);
  if (found) picked.current = found;
  const selected =
    value === null
      ? null
      : (found ?? (picked.current?.value === value ? picked.current : null));
  const status = loadError ? (
    <span className="text-danger">{loadError}</span>
  ) : loading ? (
    <span className="flex items-center gap-2 text-fg-muted">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      Loading
    </span>
  ) : null;
  return (
    <Primitive.Root<ComboboxOption<V>>
      items={options}
      value={selected}
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={
        onQueryChange ? null : (option, text) => optionMatches(option, text)
      }
      inputValue={query}
      onInputValueChange={onQueryChange}
      autoHighlight
      disabled={disabled}
    >
      <div className="relative">
        <Primitive.Input
          {...inputProps}
          placeholder={placeholder}
          className={cn(controlClass, "h-control pr-8", className)}
        />
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted"
          aria-hidden
        />
      </div>
      <Primitive.Portal>
        <Primitive.Positioner
          sideOffset={4}
          align="start"
          className={cn(zIndex.popover, "isolate")}
        >
          <Primitive.Popup
            className={cn(
              popupClass,
              "max-h-80 w-anchor min-w-60 overflow-y-auto p-1",
            )}
          >
            <Primitive.Status className="px-2.5 py-2 empty:hidden">
              {status}
            </Primitive.Status>
            {!status && (
              <Primitive.Empty className="px-2.5 py-2 text-fg-muted empty:hidden">
                {emptyText}
              </Primitive.Empty>
            )}
            {!loadError && (
              <Primitive.List className="outline-none">
                {(option: ComboboxOption<V>) => (
                  <Primitive.Item
                    key={option.value}
                    value={option}
                    className={cn(optionClass, "data-selected:font-medium")}
                  >
                    <OptionText label={option.label} detail={option.detail} />
                  </Primitive.Item>
                )}
              </Primitive.List>
            )}
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
