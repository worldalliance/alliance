import type { ToggleField } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import { ValidationMessage, type FieldInputProps } from "./fieldParts";

export function ToggleInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  required,
}: FieldInputProps<ToggleField>) {
  const hasError = errorMessage !== null;
  return (
    <div className="space-y-1">
      <label
        className={cn(
          "flex items-center justify-between gap-x-4",
          !disabled && "cursor-pointer",
        )}
      >
        <span className={hasError ? "text-red-600" : "text-zinc-700"}>
          {field.label !== null && (
            <FormMarkdownWrapper markdownContent={field.label} inline />
          )}
        </span>
        <span className="relative inline-flex shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={!!value}
            onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
            required={required}
            disabled={disabled}
            aria-invalid={hasError}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              "h-7 w-12 rounded-full bg-zinc-300 transition-colors motion-reduce:transition-none peer-checked:bg-green peer-focus-visible:ring-2 peer-focus-visible:ring-green peer-focus-visible:ring-offset-2 peer-disabled:opacity-50",
              hasError && "ring-2 ring-red-500",
            )}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none peer-checked:translate-x-5"
          />
        </span>
      </label>
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
