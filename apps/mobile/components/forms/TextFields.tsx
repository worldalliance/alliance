import type {
  DateField,
  EmailField,
  NumberField,
  TextareaField,
  TextField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { TextInput, type TextInputProps, View } from "react-native";
import CharacterLimitNotice from "../system/CharacterLimitNotice";
import { fieldAccessibilityLabel } from "./fieldAccessibilityLabel";
import {
  type FieldInputProps,
  inputClasses,
  RenderLabel,
  renderValidationMessage,
} from "./fieldParts";

const TEXTAREA_LINE_HEIGHT = 24;
const TEXTAREA_VERTICAL_PADDING = 12;

const singleLineInputProps = (
  field: TextField | EmailField | DateField,
): TextInputProps => {
  switch (field.kind) {
    case "text":
      return { placeholder: field.placeholder };
    case "email":
      return {
        placeholder: "example@email.com",
        autoCapitalize: "none",
        keyboardType: "email-address",
      };
    case "date":
      return { placeholder: "YYYY-MM-DD" };
    default:
      throw new Error(`unknown kind: ${field satisfies never}`);
  }
};

export function SingleLineInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TextField | EmailField | DateField>) {
  const inputBase = inputClasses({ hasError: errorMessage !== null, disabled });
  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <TextInput
        {...singleLineInputProps(field)}
        accessibilityLabel={fieldAccessibilityLabel(field)}
        className={inputBase}
        value={(value as string) ?? ""}
        onChangeText={(text) => onChange?.(text)}
        onFocus={onFocus}
        placeholderTextColor="#9ca3af"
        editable={!disabled}
      />
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

export function TextareaInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TextareaField>) {
  const inputBase = inputClasses({ hasError: errorMessage !== null, disabled });
  const rows = disabled ? 1 : field.rows || 3;
  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <TextInput
        accessibilityLabel={fieldAccessibilityLabel(field)}
        className={cn(inputBase, "text-base")}
        style={{
          lineHeight: TEXTAREA_LINE_HEIGHT,
          paddingVertical: TEXTAREA_VERTICAL_PADDING,
          minHeight:
            rows * TEXTAREA_LINE_HEIGHT + TEXTAREA_VERTICAL_PADDING * 2,
        }}
        value={(value as string) ?? ""}
        onChangeText={(text) => onChange?.(text)}
        onFocus={onFocus}
        placeholder={field.placeholder}
        placeholderTextColor="#9ca3af"
        editable={!disabled}
        multiline
        textAlignVertical="top"
        scrollEnabled={false}
        maxLength={field.maxLength}
      />
      {field.maxLength && (
        <CharacterLimitNotice
          value={(value as string) ?? ""}
          max={field.maxLength}
          readOnly={disabled}
        />
      )}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

export function NumberInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<NumberField>) {
  const inputBase = inputClasses({ hasError: errorMessage !== null, disabled });
  const numberDecimalPlaces = field.allowDecimals
    ? (field.decimalPlaces ?? undefined)
    : undefined;
  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <TextInput
        accessibilityLabel={fieldAccessibilityLabel(field)}
        className={inputBase}
        value={value === undefined || value === null ? "" : String(value)}
        onChangeText={(text) => {
          if (text.trim() === "") {
            onChange?.("");
            return;
          }
          if (field.allowDecimals && /^-?\d*\.?\d*$/.test(text)) {
            const next = parseFloat(text);
            if (Number.isNaN(next)) {
              onChange?.("");
            } else if (numberDecimalPlaces !== undefined) {
              const factor = Math.pow(10, numberDecimalPlaces);
              onChange?.(Math.round(next * factor) / factor);
            } else {
              onChange?.(next);
            }
            return;
          }
          const next = parseFloat(text);
          onChange?.(Number.isNaN(next) ? "" : next);
        }}
        onFocus={onFocus}
        keyboardType={field.allowDecimals ? "decimal-pad" : "numeric"}
        editable={!disabled}
      />
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
