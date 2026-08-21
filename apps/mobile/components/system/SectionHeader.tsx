import { cn } from "@alliance/shared/styles/util";
import { View } from "react-native";
import Text, { FontWeight } from "./Text";

export function SectionHeader({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <View className={cn("px-4 py-2 bg-zinc-50 mt-2", className)}>
      <Text
        className="text-xs text-zinc-400 uppercase tracking-wide"
        weight={FontWeight.Medium}
      >
        {label}
      </Text>
    </View>
  );
}
