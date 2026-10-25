import type { TimeField } from "@alliance/common/forms/form-schema";
import {
  buildTimeOfDayOptions,
  commitTimeInput,
  formatTimeForDisplay,
  parseTimeInput,
} from "@alliance/shared/forms/timeUtils";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";
import { fieldAccessibilityLabel } from "./fieldAccessibilityLabel";
import {
  type FieldInputProps,
  RenderLabel,
  sharedInputClasses,
} from "./fieldParts";
import FormModal from "./FormModal";

export function TimeInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TimeField>) {
  const normalizedValue = typeof value === "string" && value ? value : "";
  const [inputValue, setInputValue] = useState<string>(() =>
    formatTimeForDisplay(normalizedValue),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setInputValue(formatTimeForDisplay(normalizedValue));
  }, [normalizedValue]);

  const commitValue = () => {
    const { answer, error } = commitTimeInput({ raw: inputValue, required });
    setLocalError(error);
    if (answer === null) return;
    onChange?.(answer);
    if (answer) setInputValue(formatTimeForDisplay(answer));
  };

  const effectiveError = localError ?? errorMessage ?? null;
  const hasError = Boolean(effectiveError);

  const timeOptions = useMemo(
    () => buildTimeOfDayOptions(30).map((option) => option.label),
    [],
  );

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <View className="relative">
        <Pressable
          onPress={() => setShowDropdown((prev) => !prev)}
          disabled={disabled}
          className={cn(
            "flex-row items-center justify-between",
            sharedInputClasses,
            hasError ? "border-red-500" : "border-zinc-200",
            disabled && "opacity-60",
          )}
        >
          <TextInput
            accessibilityLabel={fieldAccessibilityLabel(field)}
            className="flex-1 text-base text-zinc-900"
            value={inputValue}
            onChangeText={(text) => {
              setInputValue(text);
              setLocalError(null);
            }}
            onFocus={onFocus}
            onBlur={commitValue}
            placeholder="7:30 PM"
            placeholderTextColor="#9ca3af"
            editable={!disabled}
            onSubmitEditing={commitValue}
          />
          <ChevronDown size={18} color={colors.text.icon} />
        </Pressable>

        <FormModal
          visible={showDropdown}
          onClose={() => setShowDropdown(false)}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Pick a time
            </Text>
            <TouchableOpacity onPress={() => setShowDropdown(false)}>
              <Text className="text-blue-600" weight={FontWeight.Medium}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView className="max-h-[300px]">
            {timeOptions.map((t) => (
              <TouchableOpacity
                key={t}
                className="py-3"
                onPress={() => {
                  setInputValue(t);
                  setLocalError(null);
                  setShowDropdown(false);
                  const parsed = parseTimeInput(t);
                  if (parsed) onChange?.(parsed.normalized);
                }}
              >
                <Text
                  className={cn(
                    "text-base",
                    t === inputValue ? "text-green-700" : "text-zinc-800",
                  )}
                  weight={t === inputValue ? FontWeight.Semibold : undefined}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FormModal>
      </View>

      {hasError && (
        <Text className="text-xs text-red-500 mt-1">{effectiveError}</Text>
      )}
    </View>
  );
}
