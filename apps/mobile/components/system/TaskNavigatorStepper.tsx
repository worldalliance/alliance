import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "./Text";

/** Prev/next control for the home task navigator (matches web task navigator behavior). */
export function TaskNavigatorStepper({
  index,
  totalCount,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  previousLabel = "Previous task",
  nextLabel = "Next task",
}: {
  index: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const iconColor = (enabled: boolean) =>
    enabled ? colors.text.icon : colors.text.disabled;

  return (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={onPrev}
        disabled={!canGoPrev}
        className="p-2"
        accessibilityLabel={previousLabel}
        accessibilityRole="button"
      >
        <ChevronLeft size={24} color={iconColor(canGoPrev)} strokeWidth={2.5} />
      </Pressable>
      <Text
        className="text-zinc-500 text-sm min-w-16 text-center"
        accessibilityLabel={`Task ${index + 1} of ${totalCount}`}
      >
        {index + 1} of {totalCount}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        className="p-2"
        accessibilityLabel={nextLabel}
        accessibilityRole="button"
      >
        <ChevronRight
          size={24}
          color={iconColor(canGoNext)}
          strokeWidth={2.5}
        />
      </Pressable>
    </View>
  );
}
