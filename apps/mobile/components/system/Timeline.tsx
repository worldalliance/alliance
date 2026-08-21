import { cn } from "@alliance/shared/styles/util";
import { Children, ReactNode } from "react";
import { View, ViewProps } from "react-native";

interface TimelineProps extends ViewProps {
  children: ReactNode[];
  currentIdx?: number;
}

export default function Timeline({
  children,
  currentIdx,
  className,
  ...props
}: TimelineProps) {
  const childArray = Children.toArray(children);

  return (
    <View className={cn("relative pl-2", className)} {...props}>
      <View className="absolute left-[5px] top-2 bottom-4 w-0.5 bg-zinc-100" />

      <View className="gap-y-4">
        {childArray.map((child, index) => (
          <View key={index} className="relative">
            <View
              className={cn(
                "absolute left-[-11px] top-1 w-[18px] h-[18px] rounded-full border-[3px] border-white",
                index === currentIdx ? "bg-green" : "bg-zinc-200",
              )}
            />
            <View className="pl-3">{child}</View>
          </View>
        ))}
      </View>
    </View>
  );
}
