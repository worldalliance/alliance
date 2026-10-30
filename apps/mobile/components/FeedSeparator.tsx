import { cn } from "@alliance/shared/styles/util";
import { View, type ViewProps } from "react-native";
import { colors } from "../lib/style/colors";

/** Wraps a block of the tasks homepage in the grey rule that divides the feed. */
export default function FeedSeparator({
  className,
  style,
  ...props
}: ViewProps) {
  return (
    <View
      className={cn("border-b-3", className)}
      style={[{ borderColor: colors.grey[1] }, style]}
      {...props}
    />
  );
}
