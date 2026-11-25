import type { TimePickerField } from "@alliance/common/forms/form-schema";
import { markdownAccessibleName } from "@alliance/shared/forms/markdownAccessibleName";
import {
  timeWheelControls,
  timeWheelIndexAt,
  timeWheelLayout,
  type TimeWheelColumn,
  type TimeWheelLayout,
} from "@alliance/shared/forms/timeWheel";
import { cn } from "@alliance/shared/styles/util";
import { selectionAsync } from "expo-haptics";
import { useEffect, useId, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../lib/style/colors";
import { useFontScale } from "../../lib/style/useFontScale";
import Text from "../system/Text";
import {
  RenderLabel,
  renderValidationMessage,
  type FieldInputProps,
} from "./fieldParts";

export function TimeWheelField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TimePickerField>) {
  const locked = disabled || isOutputView || !onChange;
  const { columns, turn } = timeWheelControls({ value, onChange });
  const size = timeWheelLayout(useFontScale());

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
        className="mb-4"
      />
      <View
        className="flex-row justify-center overflow-hidden rounded-2xl bg-zinc-100"
        style={{ height: size.height }}
      >
        <View
          pointerEvents="none"
          className="absolute left-2 right-2 rounded-lg bg-zinc-200"
          style={{ top: size.edge, height: size.row }}
        />
        {columns.map((column) => (
          <WheelColumn
            size={size}
            key={column.key}
            column={column}
            fieldLabel={field.label}
            disabled={locked}
            onSelect={(index) => turn(column.key, index)}
          />
        ))}
        <Fade edge={FadeEdge.Top} height={size.fade} />
        <Fade edge={FadeEdge.Bottom} height={size.fade} />
      </View>
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

enum FadeEdge {
  Top = "top",
  Bottom = "bottom",
}

const FADE_STOPS: Record<FadeEdge, { solid: string; clear: string }> = {
  [FadeEdge.Top]: { solid: "0", clear: "1" },
  [FadeEdge.Bottom]: { solid: "1", clear: "0" },
};

function Fade({ edge, height }: { edge: FadeEdge; height: number }) {
  const id = `wheel-fade-${useId().replace(/[^\w-]/g, "")}`;
  const { solid, clear } = FADE_STOPS[edge];
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height={height}
      style={{ position: "absolute", left: 0, [edge]: 0 }}
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset={solid} stopColor={colors.surfaceMuted} />
          <Stop
            offset={clear}
            stopColor={colors.surfaceMuted}
            stopOpacity="0"
          />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function WheelColumn({
  size,
  column,
  fieldLabel,
  disabled,
  onSelect,
}: {
  size: TimeWheelLayout;
  column: TimeWheelColumn;
  fieldLabel: string | null;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef(column.index * size.row);
  const last = column.options.length - 1;
  const [centred, setCentred] = useState(column.index);
  const fieldName = fieldLabel && markdownAccessibleName(fieldLabel);

  useEffect(() => {
    const y = column.index * size.row;
    if (Math.abs(offset.current - y) < 1) return;
    offset.current = y;
    ref.current?.scrollTo({ y, animated: true });
  }, [column.index, size.row]);

  const select = (index: number) => {
    const next = Math.min(Math.max(index, 0), last);
    if (disabled || next === column.index) return;
    void selectionAsync();
    onSelect(next);
  };

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    select(timeWheelIndexAt({ offset: offset.current, row: size.row, last }));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={
        fieldName ? `${fieldName}, ${column.label}` : column.label
      }
      accessibilityValue={{ text: column.options[column.index] }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        select(
          column.index +
            (event.nativeEvent.actionName === "increment" ? 1 : -1),
        )
      }
      style={{ width: size.column }}
    >
      <ScrollView
        ref={ref}
        scrollEnabled={!disabled}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={size.row}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: size.edge }}
        onLayout={() =>
          ref.current?.scrollTo({ y: offset.current, animated: false })
        }
        scrollEventThrottle={16}
        onScroll={(event) =>
          setCentred(
            timeWheelIndexAt({
              offset: event.nativeEvent.contentOffset.y,
              row: size.row,
              last,
            }),
          )
        }
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) {
            settle(event);
          }
        }}
      >
        {column.options.map((option, index) => (
          <Pressable
            key={option}
            disabled={disabled}
            onPress={() => select(index)}
            importantForAccessibility="no"
            className="items-center justify-center"
            style={{ height: size.row }}
          >
            <Text
              className={cn(
                "text-xl",
                index === centred ? "text-zinc-900" : "text-zinc-600",
              )}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
