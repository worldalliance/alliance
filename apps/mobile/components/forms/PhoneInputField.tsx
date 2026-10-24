import type { FormValue, PhoneField } from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { usePhoneFieldCountry } from "@alliance/shared/lib/usePhoneNumberField";
import { View } from "react-native";
import { fieldAccessibilityLabel } from "./fieldAccessibilityLabel";
import { RenderLabel } from "./fieldParts";
import PhoneNumberInput from "./PhoneNumberInput";

type PhoneInputFieldProps = {
  field: PhoneField;
  value: FormValue | undefined;
  onChange?: (value: FormValueUpdater) => void;
  onFocus?: () => void;
  disabled?: boolean;
  baseError: string | null;
  isOutputView?: boolean;
  hideLabel?: boolean;
  required?: boolean;
};

export function PhoneInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  baseError,
  isOutputView,
  hideLabel,
  required = !!field.required,
}: PhoneInputFieldProps) {
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
        error={baseError}
      />
    </View>
  );
}
