import { Combobox as Primitive } from "@base-ui/react/combobox";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
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
      onOpenChange={setOpen}
    >
      <div className="relative">
        <Primitive.Input
          {...inputProps}
          onKeyDown={(event) => {
            // Base UI blanks the pick on Escape while the list is closed, without a change to report.
            if (event.key === "Escape" && !open) event.preventBaseUIHandler();
          }}
          placeholder={placeholder}
          className={cn(controlClass, "h-control pr-8", className)}
        />
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted"
          aria-hidden
        />
      </div>
      <ComboboxPopup
        emptyText={emptyText}
        loading={loading}
        loadError={loadError}
      />
    </Primitive.Root>
  );
}

/**
 * Several values from a list (suites, tags, tasks): a `Combobox` whose picks
 * sit as chips in the control, ahead of its input. The box is two chip lines
 * tall whatever is picked, scrolling past that, so picking or removing moves
 * nothing below it. Backspace in the empty input or on a chip removes one,
 * and focus stays in the control.
 */
export function MultiCombobox<V extends string | number>({
  options,
  values,
  onChange,
  placeholder,
  emptyText = "No matches",
  loading = false,
  loadError,
  query,
  onQueryChange,
  disabled,
  ...inputProps
}: InputProps & {
  options: readonly ComboboxOption<V>[];
  values: readonly V[];
  onChange: (values: V[]) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  /** Said in the list in place of the options. */
  loadError?: string | null;
  query?: string;
  onQueryChange?: (query: string) => void;
  disabled?: boolean;
}) {
  // A server search can drop a picked option from `options`; its chip keeps its name.
  const picked = useRef(new Map<V, ComboboxOption<V>>());
  for (const option of options)
    if (values.includes(option.value)) picked.current.set(option.value, option);
  const selected = values.map(
    (value) => picked.current.get(value) ?? { value, label: String(value) },
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  return (
    <Primitive.Root<ComboboxOption<V>, true>
      multiple
      items={options}
      value={selected}
      onValueChange={(next) => {
        onChange(next.map((option) => option.value));
        requestAnimationFrame(() =>
          inputRef.current?.scrollIntoView({ block: "nearest" }),
        );
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
      onOpenChange={setOpen}
    >
      <Primitive.Chips
        ref={chipsRef}
        className={cn(
          controlClass,
          "flex h-15.5 flex-wrap content-start items-center gap-1 overflow-y-auto py-1 pl-1 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-accent",
          disabled && "cursor-not-allowed bg-surface-2 text-fg-muted",
        )}
      >
        <Primitive.Value>
          {(options: ComboboxOption<V>[]) =>
            options.map((option) => (
              <Primitive.Chip
                key={option.value}
                className="flex h-6 max-w-full items-center gap-0.5 rounded-sm bg-surface-2 pl-2 text-body outline-none focus:bg-accent-soft"
              >
                <span className="truncate">{option.label}</span>
                <Primitive.ChipRemove
                  aria-label={`Remove: ${option.label}`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:text-fg"
                >
                  <X className="size-3.5" aria-hidden />
                </Primitive.ChipRemove>
              </Primitive.Chip>
            ))
          }
        </Primitive.Value>
        <Primitive.Input
          {...inputProps}
          ref={inputRef}
          onKeyDown={(event) => {
            // Base UI clears every pick on Escape while the list is closed.
            if (event.key === "Escape" && !open) event.preventBaseUIHandler();
          }}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="h-6 min-w-24 flex-1 bg-transparent px-1.5 outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
        />
      </Primitive.Chips>
      <ComboboxPopup
        emptyText={emptyText}
        loading={loading}
        loadError={loadError}
        anchor={chipsRef}
      />
    </Primitive.Root>
  );
}

function ComboboxPopup<V extends string | number>({
  emptyText,
  loading,
  loadError,
  anchor,
}: {
  emptyText: string;
  loading: boolean;
  loadError?: string | null;
  /** Set for a multi-pick: the list hangs from this box, not the input, and ticks what is picked. */
  anchor?: React.RefObject<HTMLDivElement | null>;
}) {
  const status = loadError ? (
    <span className="text-danger">{loadError}</span>
  ) : loading ? (
    <span className="flex items-center gap-2 text-fg-muted">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      Loading
    </span>
  ) : null;
  return (
    <Primitive.Portal>
      <Primitive.Positioner
        anchor={anchor}
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
                  {anchor && (
                    <span className="flex size-4 shrink-0 items-center">
                      <Primitive.ItemIndicator>
                        <Check className="size-4 text-accent" aria-hidden />
                      </Primitive.ItemIndicator>
                    </span>
                  )}
                  <OptionText label={option.label} detail={option.detail} />
                </Primitive.Item>
              )}
            </Primitive.List>
          )}
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  );
}
