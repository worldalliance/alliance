import type {
  FormValue,
  NumberField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import Slider from "@react-native-community/slider";
import { View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";

// `validateFormSchema` rejects a slider without bounds, so these only cover a
// schema written before that check existed.
const FALLBACK_MIN = 0;
const FALLBACK_MAX = 100;

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

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  const answered = Number.isFinite(numeric);
  const position = answered ? Math.min(max, Math.max(min, numeric)) : min;

  const commit = (next: number) => {
    if (!onChange) return;
    if (field.allowDecimals) {
      const factor = Math.pow(10, field.decimalPlaces ?? 2);
      onChange(Math.round(next * factor) / factor);
      return;
    }
    onChange(Math.round(next));
  };

  const accent = hasError
    ? colors.error
    : answered
      ? colors.green
      : colors.text.light;

  return (
    <View>
      <Text
        className={cn("text-2xl", answered ? "text-zinc-900" : "text-zinc-400")}
      >
        {answered ? position : "—"}
      </Text>
      <Slider
        minimumValue={min}
        maximumValue={max}
        value={position}
        step={field.allowDecimals ? 0 : (field.step ?? 1)}
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
      <View className="flex-row justify-between">
        <Text className="text-xs text-zinc-500">{min}</Text>
        <Text className="text-xs text-zinc-500">{max}</Text>
      </View>
    </View>
  );
}
