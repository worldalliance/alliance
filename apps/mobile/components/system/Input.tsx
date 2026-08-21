import { cn } from "@alliance/shared/styles/util";
import { ReactNode, useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import Text, { FontWeight } from "./Text";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
  rightElement?: ReactNode;
  rightElementClassName?: string;
}

export default function Input({
  label,
  error,
  helperText,
  required = false,
  containerClassName,
  rightElement,
  rightElementClassName,
  className,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasRightElement = Boolean(rightElement);

  const borderColorClass = error
    ? "border-red-500"
    : isFocused
      ? "border-blue-500"
      : "border-zinc-200";

  const inputContainerClasses = cn(
    "border rounded-lg bg-white px-3 min-h-11",
    hasRightElement && "flex-row items-center",
    borderColorClass,
  );
  const inputClasses = cn(
    "text-base text-zinc-700 py-3",
    hasRightElement && "flex-1",
    className,
  );

  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-sm text-zinc-700 mb-2" weight={FontWeight.Medium}>
          {label}
          {required && <Text className="text-red-500"> *</Text>}
        </Text>
      )}
      <View className={inputContainerClasses}>
        <TextInput
          className={inputClasses}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#9ca3af"
          underlineColorAndroid="transparent"
          {...textInputProps}
        />
        {hasRightElement ? (
          <View className={cn("ml-2", rightElementClassName)}>
            {rightElement}
          </View>
        ) : null}
      </View>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
      {helperText && !error && (
        <Text className="text-xs text-zinc-500 mt-1">{helperText}</Text>
      )}
    </View>
  );
}
