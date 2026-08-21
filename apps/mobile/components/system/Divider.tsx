import { View, ViewProps } from "react-native";

export enum DividerOrientation {
  Horizontal = "horizontal",
  Vertical = "vertical",
}

interface DividerProps extends ViewProps {
  orientation?: DividerOrientation;
}

export default function Divider({
  orientation = DividerOrientation.Horizontal,
  className,
  ...props
}: DividerProps) {
  const orientationClasses =
    orientation === DividerOrientation.Horizontal
      ? "h-px w-full"
      : "w-px h-full";

  const combinedClasses = `flex-1 bg-zinc-200 ${orientationClasses} ${className || ""}`;

  return <View className={combinedClasses} {...props} />;
}
