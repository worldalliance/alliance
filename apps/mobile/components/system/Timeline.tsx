import { cn } from "@alliance/shared/styles/util";
import { Children, ReactNode } from "react";
import { View, ViewProps } from "react-native";

interface TimelineProps extends ViewProps {
  children: ReactNode[];
  currentIdx?: number;
  /** Steps shown green. */
  doneIndices?: number[];
}

export default function Timeline({
  children,
  currentIdx,
  doneIndices = [],
  className,
  ...props
}: TimelineProps) {
  const childArray = Children.toArray(children);

  return (
    <View className={cn("pl-2", className)} {...props}>
      {childArray.map((child, index) => {
        const last = index === childArray.length - 1;
        return (
          <View key={index} className={cn("relative", !last && "pb-4")}>
            {last ? null : (
              <View className="absolute left-[-3px] top-2 -bottom-2 w-0.5 bg-zinc-100" />
            )}
            <View
              className={cn(
                "absolute left-[-11px] top-1 h-[18px] w-[18px] rounded-full border-[3px] border-white",
                index === currentIdx || doneIndices.includes(index)
                  ? "bg-green"
                  : "bg-zinc-200",
              )}
            />
            <View className="pl-3">{child}</View>
          </View>
        );
      })}
    </View>
  );
}
