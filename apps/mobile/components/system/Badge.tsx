import { cn } from "@alliance/shared/styles/util";
import { View, ViewProps } from "react-native";
import Text, { FontWeight } from "./Text";

export enum BadgeColor {
  Default = "default",
  Green = "green",
  Blue = "blue",
  Red = "red",
  Yellow = "yellow",
  Purple = "purple",
}

export enum BadgeSize {
  Small = "small",
  Medium = "medium",
  Large = "large",
}

interface BadgeProps extends ViewProps {
  text: string;
  color?: BadgeColor;
  size?: BadgeSize;
}

const colorClasses: Record<BadgeColor, { container: string; text: string }> = {
  [BadgeColor.Default]: {
    container: "bg-zinc-200",
    text: "text-zinc-700",
  },
  [BadgeColor.Green]: {
    container: "bg-green-100",
    text: "text-green-800",
  },
  [BadgeColor.Blue]: {
    container: "bg-blue-100",
    text: "text-blue-800",
  },
  [BadgeColor.Red]: {
    container: "bg-red-100",
    text: "text-red-600",
  },
  [BadgeColor.Yellow]: {
    container: "bg-amber-100",
    text: "text-amber-700",
  },
  [BadgeColor.Purple]: {
    container: "bg-purple-100",
    text: "text-purple-700",
  },
};

const sizeClasses: Record<BadgeSize, { container: string; text: string }> = {
  [BadgeSize.Small]: {
    container: "px-1.5 py-0.5 min-h-5",
    text: "text-xs",
  },
  [BadgeSize.Medium]: {
    container: "px-2 py-1 min-h-6",
    text: "text-xs",
  },
  [BadgeSize.Large]: {
    container: "px-3 py-1.5 min-h-7",
    text: "text-sm",
  },
};

export default function Badge({
  text,
  color = BadgeColor.Default,
  size = BadgeSize.Medium,
  className,
  ...props
}: BadgeProps) {
  const colorStyle = colorClasses[color];
  const sizeStyle = sizeClasses[size];

  const containerClasses = cn(
    "self-start rounded-full items-center justify-center",
    colorStyle.container,
    sizeStyle.container,
    className,
  );
  const textClasses = cn("text-center", colorStyle.text, sizeStyle.text);

  return (
    <View className={containerClasses} {...props}>
      <Text className={textClasses} weight={FontWeight.Medium}>
        {text}
      </Text>
    </View>
  );
}
