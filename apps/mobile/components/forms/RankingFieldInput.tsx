import type {
  FormValue,
  RankingField,
} from "@alliance/common/forms/form-schema";
import {
  getRankingOptionLabel,
  getRankingSlotCount,
  sanitizeRankingValue,
} from "@alliance/common/forms/ranking";
import { cn } from "@alliance/shared/styles/util";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import Text, { FontWeight } from "../system/Text";

/** Vertical gap between slot rows (`gap-y-2`), included in drag distance math. */
const ROW_GAP = 8;
const FALLBACK_ROW_HEIGHT = 48;
const DRAG_LONG_PRESS_MS = 200;
const REORDER_ANIMATION_MS = 200;

type RankingFieldInputProps = {
  field: RankingField;
  value: FormValue | undefined;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  hasError?: boolean;
  isOutputView?: boolean;
};

type RankedSlotRowProps = {
  /** Markdown label of the ranked option. */
  label: string;
  slotIndex: number;
  interactive: boolean;
  onRemove: (slotIndex: number) => void;
  onDragEnd: (fromIndex: number, translationY: number) => void;
  onMeasure: (slotIndex: number, height: number) => void;
};

function SlotNumberBadge({
  slotIndex,
  filled,
}: {
  slotIndex: number;
  filled: boolean;
}) {
  return (
    <View
      className={cn(
        // Rows are top-aligned; mt-3 centers the badge on the card's first
        // line of text (py-3 + one markdown line).
        "w-6 h-6 mt-3 rounded-full items-center justify-center shrink-0",
        filled ? "bg-green" : "bg-zinc-200",
      )}
    >
      <Text
        className={cn("text-xs", filled ? "text-white" : "text-zinc-500")}
        weight={FontWeight.Medium}
      >
        {slotIndex + 1}
      </Text>
    </View>
  );
}

function RankedSlotRow({
  label,
  slotIndex,
  interactive,
  onRemove,
  onDragEnd,
  onMeasure,
}: RankedSlotRowProps) {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .enabled(interactive)
    .activateAfterLongPress(DRAG_LONG_PRESS_MS)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      scheduleOnRN(onDragEnd, slotIndex, event.translationY);
    })
    .onFinalize(() => {
      isDragging.value = false;
      // Ease back over the same duration as the row's layout transition: on a
      // reorder the two roughly cancel, so the row glides from the finger to
      // its new slot; on a cancelled drag it springs back to its old slot.
      translateY.value = withTiming(0, { duration: REORDER_ANIMATION_MS });
    });

  // The row (badge + card) animates reorders via the layout transition; only
  // the card follows the finger, so the rank number stays put in its slot.
  const rowStyle = useAnimatedStyle(() => ({
    zIndex: isDragging.value ? 10 : 0,
    elevation: isDragging.value ? 4 : 0,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.03 : 1) },
    ],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(REORDER_ANIMATION_MS)}
      style={rowStyle}
      className="flex-row items-start gap-x-3"
      onLayout={(event) =>
        onMeasure(slotIndex, event.nativeEvent.layout.height)
      }
    >
      <SlotNumberBadge slotIndex={slotIndex} filled />
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={cardStyle}
          className="flex-1 flex-row items-center gap-x-3 rounded-lg border border-zinc-300 bg-white px-3 py-3"
        >
          <View className="flex-1">
            <AppMarkdownWrapper markdownContent={label} />
          </View>
          {interactive && (
            <TouchableOpacity
              className="shrink-0 p-1"
              onPress={() => onRemove(slotIndex)}
              activeOpacity={0.7}
              accessibilityLabel={`Remove item ranked ${slotIndex + 1}`}
            >
              {/* zinc-400 */}
              <X size={16} color="#a1a1aa" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export function RankingFieldInput({
  field,
  value,
  onChange,
  disabled,
  hasError,
  isOutputView,
}: RankingFieldInputProps) {
  const ranked = sanitizeRankingValue(field, value);
  const slotCount = getRankingSlotCount(field);
  const interactive = !disabled && !!onChange && !isOutputView;
  const rowHeights = useRef(new Map<number, number>());

  // Saved answers can go stale (an admin edits the option list after a draft
  // was saved). The list renders the sanitized ranking, so commit it whenever
  // it differs from the stored array — otherwise validation and submission
  // would see a stale value the user can't see.
  useEffect(() => {
    if (!interactive || !Array.isArray(value)) return;
    if (
      value.length === ranked.length &&
      value.every((entry, index) => entry === ranked[index])
    ) {
      return;
    }
    onChange?.(ranked);
  });

  const handleMeasure = (slotIndex: number, height: number) => {
    rowHeights.current.set(slotIndex, height);
  };

  const handleToggle = (option: string) => {
    if (!onChange) return;
    if (ranked.includes(option)) {
      onChange(ranked.filter((entry) => entry !== option));
    } else if (ranked.length < slotCount) {
      onChange([...ranked, option]);
      impactAsync(ImpactFeedbackStyle.Light);
    }
  };

  const handleRemove = (slotIndex: number) => {
    onChange?.(ranked.filter((_, index) => index !== slotIndex));
  };

  /**
   * Walk row heights (plus the gap between rows) from the drag origin to find
   * the slot the row was dropped closest to. Only filled slots are valid
   * targets — reordering can't leave gaps.
   */
  const computeTargetIndex = (fromIndex: number, translationY: number) => {
    const stepHeight = (index: number) =>
      (rowHeights.current.get(index) ?? FALLBACK_ROW_HEIGHT) + ROW_GAP;
    let target = fromIndex;
    let remaining = Math.abs(translationY);
    const direction = translationY > 0 ? 1 : -1;
    while (true) {
      const next = target + direction;
      if (next < 0 || next >= ranked.length) break;
      if (remaining < stepHeight(next) / 2) break;
      remaining -= stepHeight(next);
      target = next;
    }
    return target;
  };

  const handleDragEnd = (fromIndex: number, translationY: number) => {
    if (!onChange) return;
    const target = computeTargetIndex(fromIndex, translationY);
    if (target === fromIndex) return;
    const next = [...ranked];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    onChange(next);
    impactAsync(ImpactFeedbackStyle.Light);
  };

  if (isOutputView) {
    return (
      <View className="gap-y-2">
        {ranked.map((option, slotIndex) => (
          <View key={option} className="flex-row items-start gap-x-3">
            <SlotNumberBadge slotIndex={slotIndex} filled />
            <View className="flex-1 flex-row items-center rounded-lg border border-zinc-300 bg-white px-3 py-3">
              <View className="flex-1">
                <AppMarkdownWrapper
                  markdownContent={getRankingOptionLabel(field, option)}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  const slotsFull = ranked.length >= slotCount;

  return (
    <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
      <View className="gap-y-2">
        {field.options.map((option) => {
          const isRanked = ranked.includes(option.value);
          const optionDisabled = !interactive || (!isRanked && slotsFull);
          return (
            <TouchableOpacity
              key={option.value}
              className={cn(
                "rounded-lg border px-3 py-3",
                isRanked
                  ? "border-zinc-200 bg-zinc-100"
                  : hasError
                    ? "border-red-500 bg-white"
                    : "border-zinc-300 bg-white",
                !isRanked && slotsFull && "opacity-60",
              )}
              onPress={() => handleToggle(option.value)}
              disabled={optionDisabled}
              activeOpacity={0.7}
            >
              <View className={cn(isRanked && "opacity-40")}>
                <AppMarkdownWrapper markdownContent={option.label} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View className="mt-3 gap-y-2">
        {Array.from({ length: slotCount }, (_, slotIndex) => {
          const option = ranked[slotIndex];
          if (option !== undefined) {
            return (
              <RankedSlotRow
                key={option}
                label={getRankingOptionLabel(field, option)}
                slotIndex={slotIndex}
                interactive={interactive}
                onRemove={handleRemove}
                onDragEnd={handleDragEnd}
                onMeasure={handleMeasure}
              />
            );
          }
          return (
            <View
              key={`empty-${slotIndex}`}
              className="flex-row items-start gap-x-3"
            >
              <SlotNumberBadge slotIndex={slotIndex} filled={false} />
              <View className="flex-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-3">
                <Text className="text-base text-zinc-400">Select an item</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
