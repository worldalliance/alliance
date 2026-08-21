import { cn } from "@alliance/shared/styles/util";
import React from "react";
import {
  ActivityIndicator,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";
import Text, { FontWeight } from "./Text";

export enum ButtonColor {
  Black = "black",
  Green = "green",
  Blue = "blue",
  Red = "red",
  Light = "light",
  Outline = "outline",
  White = "white",
  Transparent = "transparent",
}

export enum ButtonSize {
  Small = "small",
  Medium = "medium",
  Large = "large",
  Custom = "custom",
}

interface ButtonProps extends TouchableOpacityProps {
  onPress: () => void;
  color?: ButtonColor;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  title?: string;
}

const colorClasses: Record<ButtonColor, string> = {
  [ButtonColor.Black]: "bg-zinc-800 border border-zinc-800",
  [ButtonColor.Green]: "bg-green border border-green",
  [ButtonColor.Blue]: "bg-blue-500 border border-blue-500",
  [ButtonColor.Red]: "bg-red-100 border border-red-500",
  [ButtonColor.Light]: "bg-stone-200 border border-stone-300",
  [ButtonColor.Outline]: "bg-transparent border border-stone-300",
  [ButtonColor.White]: "bg-white border border-stone-300",
  [ButtonColor.Transparent]: "bg-transparent border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  [ButtonSize.Small]: "px-3 py-1.5 min-h-8",
  [ButtonSize.Medium]: "px-4 py-2 min-h-10",
  [ButtonSize.Large]: "px-5 py-3 min-h-12",
  [ButtonSize.Custom]: "",
};

const textColorClasses: Record<ButtonColor, string> = {
  [ButtonColor.Black]: "text-white",
  [ButtonColor.Green]: "text-white",
  [ButtonColor.Blue]: "text-white",
  [ButtonColor.Red]: "text-red-500",
  [ButtonColor.Light]: "text-zinc-800",
  [ButtonColor.Outline]: "text-zinc-800",
  [ButtonColor.White]: "text-zinc-800",
  [ButtonColor.Transparent]: "text-zinc-800",
};

export default function Button({
  onPress,
  color = ButtonColor.Black,
  size = ButtonSize.Medium,
  disabled = false,
  loading = false,
  className,
  children,
  title,
  ...props
}: ButtonProps) {
  const combinedClasses = cn(
    "flex-row items-center justify-center rounded-sm",
    colorClasses[color],
    sizeClasses[size],
    disabled && "opacity-50",
    className,
  );

  const textClass = textColorClasses[color];

  return (
    <TouchableOpacity
      className={combinedClasses}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            color === ButtonColor.Outline ||
            color === ButtonColor.White ||
            color === ButtonColor.Light
              ? "#444"
              : "#fff"
          }
        />
      ) : children ? (
        children
      ) : title ? (
        <Text className={textClass} weight={FontWeight.Medium}>
          {title}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
