import type { CheckboxField } from "@alliance/common/forms/form-schema";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import {
  type FieldInputProps,
  fieldInputClassName,
  ValidationMessage,
} from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export function CheckboxInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  required,
}: FieldInputProps<CheckboxField>) {
  const hasError = errorMessage !== null;
  const checkboxPosition = field.checkboxPosition ?? "left";
  const checkboxInput = (
    <input
      type="checkbox"
      checked={!!value}
      onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      required={required}
      disabled={disabled}
      aria-invalid={hasError}
      className={fieldInputClassName({
        base: `shrink-0 mt-px h-5 w-5 cursor-pointer ${
          checkboxPosition === "right" ? "ml-2 pr-5" : "mr-2"
        } ${
          hasError ? "text-red-600" : "text-blue-600"
        } focus:outline-none rounded`,
        hasError,
        normal: "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
        error: "border border-red-500 focus:ring-red-500 focus:ring-2",
      })}
    />
  );
  const checkboxLabel = (
    <span className={hasError ? "text-red-600" : "text-zinc-700"}>
      {field.label !== null && (
        <FormMarkdownWrapper markdownContent={field.label} inline />
      )}
    </span>
  );
  return (
    <div className="space-y-1 pr-5">
      {!required && !isOutputView && <OptionalLabelPrefix />}
      <label className="flex items-start">
        {checkboxPosition === "right" ? (
          <>
            {checkboxLabel}
            {checkboxInput}
          </>
        ) : (
          <>
            {checkboxInput}
            {checkboxLabel}
          </>
        )}
      </label>
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
