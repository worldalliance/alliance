import type { PhoneField } from "@alliance/common/forms/form-schema";
import {
  type FieldInputProps,
  RenderLabel,
  useQuestionLabelId,
} from "./fieldParts";
import { LazyPhoneNumberInput } from "./lazyFieldInputs";

export function PhoneInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<PhoneField>) {
  const labelId = useQuestionLabelId(field);
  const answer = typeof value === "string" ? value : "";

  return (
    <div className="space-y-1">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <LazyPhoneNumberInput
        labelId={labelId}
        name={field.id}
        value={answer}
        onChange={(next) => onChange?.(next)}
        disabled={disabled || !onChange}
        required={required}
        placeholder={field.placeholder || "Enter phone number"}
        error={errorMessage ?? undefined}
      />
    </div>
  );
}
