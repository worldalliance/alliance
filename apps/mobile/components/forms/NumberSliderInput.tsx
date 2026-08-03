import {
  formatNumberFieldValue,
  type FormValue,
  type NumberField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import Slider from "@react-native-community/slider";
import { useRef, useState } from "react";
import { PanResponder, View, type LayoutChangeEvent } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";

// `validateFormSchema` rejects a slider without bounds, so these only cover a
// schema written before that check existed.
const FALLBACK_MIN = 0;
const FALLBACK_MAX = 100;

/** Approximates the native thumb, so the tail can track the thumb's centre. */
const THUMB_SIZE_PX = 24;
const TAIL_SIZE_PX = 12;
/**
 * How far the tail's tip must stay inside each end of the bubble: the corner
 * radius plus half the tail's rotated width, so it never straddles a corner.
 */
const TAIL_INSET_PX = 15;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

export default function NumberSliderInput({
  field,
  value,
  onChange,
  disabled,
  hasError,
}: {
  field: NumberField;
  value?: FormValue;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const min = field.min ?? FALLBACK_MIN;
  const max = field.max ?? FALLBACK_MAX;
  const step = field.allowDecimals ? 0 : (field.step ?? 1);

  const [trackWidth, setTrackWidth] = useState(0);
  const [bubbleWidth, setBubbleWidth] = useState(0);

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  const answered = Number.isFinite(numeric);
  const position = answered ? Math.min(max, Math.max(min, numeric)) : min;
  const fraction = max > min ? (position - min) / (max - min) : 0;
  const interactive = !disabled && !!onChange;

  // The thumb's centre travels between half a thumb-width in from each end,
  // not across the track's full width.
  const travel = Math.max(0, trackWidth - THUMB_SIZE_PX);
  const thumbCentre = fraction * travel + THUMB_SIZE_PX / 2;
  // Centred on the thumb where there's room, otherwise flush to whichever end
  // it would have overflowed.
  const bubbleLeft = clamp(
    thumbCentre - bubbleWidth / 2,
    0,
    Math.max(0, trackWidth - bubbleWidth),
  );
  const tailCentre = clamp(
    thumbCentre,
    bubbleLeft + TAIL_INSET_PX,
    Math.max(
      bubbleLeft + TAIL_INSET_PX,
      bubbleLeft + bubbleWidth - TAIL_INSET_PX,
    ),
  );

  const commit = (next: number) => {
    if (!onChange) return;
    if (field.allowDecimals) {
      const factor = Math.pow(10, field.decimalPlaces ?? 2);
      onChange(Math.round(next * factor) / factor);
      return;
    }
    onChange(Math.round(next));
  };

  /** Clamp to the range and onto the step grid, which is anchored at `min`. */
  const snap = (raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    if (step <= 0) return clamped;
    return Math.min(max, min + Math.round((clamped - min) / step) * step);
  };

  // Held in a ref so the move handler reads the value the gesture began at,
  // whichever render's closure the responder system ends up invoking.
  const dragStartValue = useRef(0);
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => interactive,
    onMoveShouldSetPanResponder: () => interactive,
    onPanResponderGrant: () => {
      dragStartValue.current = position;
      // A drag that ends where it started still counts as answering.
      commit(position);
    },
    onPanResponderMove: (_event, gesture) => {
      if (travel <= 0) return;
      // Scaled to the thumb's own travel, so the bubble keeps pace with the
      // finger rather than drifting away from it.
      const perPixel = (max - min) / travel;
      commit(snap(dragStartValue.current + gesture.dx * perPixel));
    },
  });

  const accent = hasError
    ? colors.error
    : answered
      ? colors.green
      : colors.text.light;

  const onTrackLayout = (event: LayoutChangeEvent) =>
    setTrackWidth(event.nativeEvent.layout.width);
  const onBubbleLayout = (event: LayoutChangeEvent) =>
    setBubbleWidth(event.nativeEvent.layout.width);

  return (
    <View>
      <View className="h-11">
        <View
          {...panResponder.panHandlers}
          onLayout={onBubbleLayout}
          style={{
            position: "absolute",
            bottom: 10,
            left: bubbleLeft,
            borderColor: accent,
          }}
          className="rounded-md border bg-white px-2 py-0.5"
        >
          <Text
            className={cn(
              "text-xl",
              answered ? "text-zinc-900" : "text-zinc-400",
            )}
          >
            {answered ? formatNumberFieldValue(field, position) : "—"}
          </Text>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 4,
            left: tailCentre - TAIL_SIZE_PX / 2,
            width: TAIL_SIZE_PX,
            height: TAIL_SIZE_PX,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderColor: accent,
            backgroundColor: colors.white,
            transform: [{ rotate: "45deg" }],
          }}
        />
      </View>
      <View onLayout={onTrackLayout}>
        <Slider
          minimumValue={min}
          maximumValue={max}
          value={position}
          step={step}
          disabled={disabled}
          onValueChange={commit}
          // A tap that lands exactly on the thumb moves it nowhere, so
          // `onValueChange` never fires — without this, an answer of `min` on an
          // untouched slider would be unrecordable.
          onSlidingComplete={commit}
          minimumTrackTintColor={answered ? accent : colors.switch.trackOff}
          maximumTrackTintColor={colors.switch.trackOff}
          thumbTintColor={accent}
        />
      </View>
      {/* Bare bounds: the template describes the answer, and a wordy one
          ("${value}% of plastic recycled") reads as clutter on an axis. */}
      <View className="flex-row justify-between">
        <Text className="text-xs text-zinc-500">{min}</Text>
        <Text className="text-xs text-zinc-500">{max}</Text>
      </View>
    </View>
  );
}
