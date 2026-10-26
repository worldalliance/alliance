import type { PhoneField } from "@alliance/common/forms/form-schema";
import { usePhoneFieldCountry } from "@alliance/shared/lib/usePhoneNumberField";
import PhoneNumberInput from "../ui/PhoneNumberInput";
import {
  type FieldInputProps,
  RenderLabel,
  useQuestionLabelId,
} from "./fieldParts";

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
  const [country, setCountry] = usePhoneFieldCountry(answer);

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
      <PhoneNumberInput
        labelId={labelId}
        name={field.id}
        value={answer}
        onChange={(next) => onChange?.(next)}
        country={country}
        onCountryChange={setCountry}
        disabled={disabled || !onChange}
        required={required}
        placeholder={field.placeholder || "Enter phone number"}
        error={errorMessage ?? undefined}
      />
    </div>
  );
}
