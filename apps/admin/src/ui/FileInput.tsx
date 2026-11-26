import { useEffect, useRef } from "react";
import { ButtonVariant, buttonVariants } from "./Button";
import { cn } from "./cn";

/**
 * A "Choose file…" button with the chosen names beside it. The caller holds
 * the files; handing back an empty `value` clears the control, so the same
 * file can be chosen again; `emptyText` then says what was uploaded.
 */
export function FileInput({
  value,
  onChange,
  multiple = false,
  emptyText,
  className,
  id,
  ...input
}: Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "multiple" | "id"
> & {
  /** Required: it ties the button to the input. A `Field` supplies it. */
  id: string;
  value: readonly File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  /** Shown while `value` is empty, such as "Uploaded notes.csv" after the caller cleared it. */
  emptyText?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value.length === 0 && ref.current) ref.current.value = "";
  }, [value]);

  const names = value.map((file) => file.name).join(", ");
  return (
    <div
      className={cn("relative flex min-w-0 items-center gap-2.5", className)}
    >
      {/* The native input keeps focus, the keyboard and the screen reader's
          "file upload" role; the label beside it is only its visible face. */}
      <input
        {...input}
        ref={ref}
        id={id}
        type="file"
        multiple={multiple}
        className="peer sr-only"
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />
      <label
        htmlFor={id}
        className={cn(
          buttonVariants({ variant: ButtonVariant.Default, size: "medium" }),
          "inline-flex shrink-0 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:pointer-events-none peer-disabled:opacity-50 peer-aria-invalid:border-danger",
        )}
      >
        {multiple ? "Choose files…" : "Choose file…"}
      </label>
      <span
        className={cn("min-w-0 truncate", !names && "text-fg-muted")}
        title={names || undefined}
      >
        {names ||
          emptyText ||
          (multiple ? "No files chosen" : "No file chosen")}
      </span>
    </div>
  );
}
