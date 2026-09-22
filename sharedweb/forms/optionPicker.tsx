import { cn } from "@alliance/shared/styles/util";
import { Combobox } from "@base-ui/react/combobox";

export const popupClassName =
  "flex flex-col w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-hidden rounded border border-zinc-300 bg-white shadow-lg";
export const listClassName =
  "min-h-0 max-h-72 overflow-y-auto overscroll-contain";
export const itemClassName =
  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-zinc-900 data-highlighted:bg-zinc-100";

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
