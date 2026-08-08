import { cn } from "@alliance/shared/styles/util";
import { View, ViewProps } from "react-native";
import Text, { FontWeight } from "./Text";

export enum StatusType {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
  Success = "success",
  Warning = "warning",
  Error = "error",
  Info = "info",
}

export enum StatusSize {
  Small = "small",
  Medium = "medium",
  Large = "large",
}

interface StatusIndicatorProps extends ViewProps {
  status: StatusType;
  text?: string;
  size?: StatusSize;
  showText?: boolean;
}

const dotColorClasses: Record<StatusType, string> = {
  [StatusType.Active]: "bg-green-500",
  [StatusType.Inactive]: "bg-zinc-500",
  [StatusType.Pending]: "bg-yellow-500",
  [StatusType.Success]: "bg-green-500",
  [StatusType.Warning]: "bg-amber-500",
  [StatusType.Error]: "bg-red-500",
  [StatusType.Info]: "bg-blue-500",
};

const textColorClasses: Record<StatusType, string> = {
  [StatusType.Active]: "text-green-700",
  [StatusType.Inactive]: "text-zinc-500",
  [StatusType.Pending]: "text-yellow-600",
  [StatusType.Success]: "text-green-700",
  [StatusType.Warning]: "text-amber-600",
  [StatusType.Error]: "text-red-600",
  [StatusType.Info]: "text-blue-600",
};

const sizeClasses: Record<
  StatusSize,
  { gap: string; dot: string; text: string }
> = {
  [StatusSize.Small]: { gap: "gap-1", dot: "w-1.5 h-1.5", text: "text-xs" },
  [StatusSize.Medium]: { gap: "gap-1.5", dot: "w-2 h-2", text: "text-xs" },
  [StatusSize.Large]: { gap: "gap-2", dot: "w-2.5 h-2.5", text: "text-sm" },
};

export default function StatusIndicator({
  status,
  text,
  size = StatusSize.Medium,
  showText = true,
  className,
  ...props
}: StatusIndicatorProps) {
  const displayText = text || status.charAt(0).toUpperCase() + status.slice(1);
  const sizeStyle = sizeClasses[size];

  const containerClasses = cn(
    "flex-row items-center self-start",
    sizeStyle.gap,
    className,
  );
  const dotClasses = cn("rounded-full", sizeStyle.dot, dotColorClasses[status]);
  const textClasses = cn(sizeStyle.text, textColorClasses[status]);

  return (
    <View className={containerClasses} {...props}>
      <View className={dotClasses} />
      {showText && (
        <Text className={textClasses} weight={FontWeight.Medium}>
          {displayText}
        </Text>
      )}
    </View>
  );
}
