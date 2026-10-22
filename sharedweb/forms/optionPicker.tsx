import type { OptionCategory } from "@alliance/common/forms/options-schema";
import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";
import { type KeyboardEvent, type ReactNode, useState } from "react";

export const popupClassName =
  "flex flex-col w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-hidden rounded border border-zinc-300 bg-white shadow-lg";
export const listClassName =
  "min-h-0 max-h-72 overflow-y-auto overscroll-contain";
export const itemClassName =
  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-zinc-900 data-highlighted:bg-zinc-100";

export const groupLabelClassName =
  "px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500";

export function ComboboxSection({
  category,
  children,
}: {
  category: OptionCategory | null;
  children: ReactNode;
}) {
  if (!category) return children;
  return (
    <Combobox.Group>
      <Combobox.GroupLabel className={groupLabelClassName}>
        {category.name}
      </Combobox.GroupLabel>
      {children}
    </Combobox.Group>
  );
}

export function CheckboxSection({
  category,
  headingId,
  children,
}: {
  category: OptionCategory | null;
  headingId: string;
  children: ReactNode;
}) {
  if (!category) return children;
  return (
    <div role="group" aria-labelledby={headingId} className="space-y-2 pt-2">
      <p id={headingId} className="text-sm font-semibold text-zinc-800">
        {category.name}
      </p>
      {children}
    </div>
  );
}

export function triggerProps(params: {
  labelId?: string;
  required?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return {
    "aria-labelledby": params.labelId,
    "aria-label": params.labelId ? undefined : "Options",
    "aria-required": params.required,
    "aria-invalid": params.invalid,
    className: cn(
      params.className,
      "flex w-full items-center justify-between gap-2 text-left disabled:cursor-default!",
    ),
  };
}

export function OptionSearch({ labelId }: { labelId?: string }) {
  return (
    <>
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
    </>
  );
}

export function useOptionSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  return {
    query,
    rootProps: {
      open,
      onOpenChange: (next: boolean) => {
        setOpen(next);
        if (next) setQuery("");
      },
      inputValue: query,
      onInputValueChange: (
        next: string,
        details: Combobox.Root.ChangeEventDetails,
      ) => {
        if (details.reason !== "input-clear") setQuery(next);
      },
      // Only "always" highlights a query set from the trigger rather than typed.
      // Root forwards it to AriaCombobox, which accepts it; Root's type omits it.
      autoHighlight: (query.trim() ? "always" : true) as unknown as boolean,
    },
    onTriggerKeyDown: (event: KeyboardEvent) => {
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
    },
  };
}
