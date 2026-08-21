import { cn } from "@alliance/shared/styles/util";
import { View, ViewProps } from "react-native";

interface ProgressBarProps extends ViewProps {
  percentage: number;
}

export default function ProgressBar({
  percentage,
  className,
  ...props
}: ProgressBarProps) {
  return (
    <View className={cn("flex-row items-center gap-3", className)} {...props}>
      <View className="flex-1 h-3 bg-zinc-100 rounded overflow-hidden">
        <View
          className="h-full rounded bg-green"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </View>
    </View>
  );
}
