import type { ToggleField } from "@alliance/common/forms/form-schema";
import { markdownAccessibleName } from "@alliance/shared/forms/markdownAccessibleName";
import { Switch, View } from "react-native";
import { colors } from "../../lib/style/colors";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";
import { renderValidationMessage, type FieldInputProps } from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export function ToggleInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  required,
}: FieldInputProps<ToggleField>) {
  return (
    <View>
      {!required && !isOutputView && <OptionalLabelPrefix />}
      <View className="flex-row items-center justify-between gap-x-4">
        <View className="flex-1">
          <InlineLabelMarkdownWrapper>
            {field.label ?? ""}
          </InlineLabelMarkdownWrapper>
        </View>
        <Switch
          value={!!value}
          onValueChange={(next) => onChange?.(next)}
          disabled={disabled}
          trackColor={{ true: colors.green, false: colors.switch.trackOff }}
          ios_backgroundColor={colors.switch.trackOff}
          thumbColor={colors.white}
          accessibilityLabel={
            field.label === null
              ? undefined
              : markdownAccessibleName(field.label)
          }
        />
      </View>
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
