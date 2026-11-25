import { cn } from "@alliance/shared/styles/util";
import { useEffect } from "react";
import { View, ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";

interface ProgressBarProps extends ViewProps {
  percentage: number;
  /** Restarts the fill when its identity changes, so pass a constant. */
  fillTiming?: WithTimingConfig;
}

const FILL_TIMING: WithTimingConfig = {
  duration: 400,
  easing: Easing.out(Easing.cubic),
};

// Starts at the first value it's given, so only later changes animate.
const Fill = ({
  percentage,
  timing,
}: {
  percentage: number;
  timing: WithTimingConfig;
}) => {
  const width = useSharedValue(percentage);

  useEffect(() => {
    width.value = withTiming(percentage, timing);
  }, [percentage, timing, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return <Animated.View className="h-full rounded bg-green" style={style} />;
};

export default function ProgressBar({
  percentage,
  fillTiming = FILL_TIMING,
  className,
  ...props
}: ProgressBarProps) {
  return (
    <View className={cn("flex-row items-center gap-3", className)} {...props}>
      <View className="flex-1 h-3 bg-zinc-100 rounded overflow-hidden">
        <Fill percentage={Math.min(percentage, 100)} timing={fillTiming} />
      </View>
    </View>
  );
}
