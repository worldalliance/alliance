import type { PhoneField } from "@alliance/common/forms/form-schema";
import { usePhoneFieldCountry } from "@alliance/shared/lib/usePhoneNumberField";
import { View } from "react-native";
import { fieldAccessibilityLabel } from "./fieldAccessibilityLabel";
import { type FieldInputProps, RenderLabel } from "./fieldParts";
import PhoneNumberInput from "./PhoneNumberInput";

export function PhoneInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<PhoneField>) {
  const answer = typeof value === "string" ? value : "";
  const [country, setCountry] = usePhoneFieldCountry(answer);

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <PhoneNumberInput
        value={answer}
        onChange={(next) => onChange?.(next)}
        country={country}
        onCountryChange={setCountry}
        onEditingChange={(editing) => {
          if (editing) {
            onFocus?.();
          }
        }}
        disabled={disabled || !onChange}
        accessibilityLabel={fieldAccessibilityLabel(field)}
        placeholder={field.placeholder || "Enter phone number"}
        error={errorMessage}
      />
    </View>
  );
}
