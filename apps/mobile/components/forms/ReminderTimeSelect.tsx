import {
  buildTimeOfDayOptions,
  formatTimeForDisplay,
  toWireTime,
} from "@alliance/shared/forms/timeUtils";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, Clock } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { BottomSheetOptionRow } from "../BottomSheetOptionPicker";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

const STEP_MINUTES = 15;
/** Approximate row height, used only to open the list near the current value. */
const ROW_HEIGHT = 48;

type Props = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function ReminderTimeSelect({
  value,
  onChange,
  placeholder = "No preferred time",
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = toWireTime(value);

  const options = useMemo(() => {
    const grid = buildTimeOfDayOptions(STEP_MINUTES);
    if (!selected || grid.some((option) => option.value === selected)) {
      return grid;
    }
    // A time set before this picker existed, or from the web's minute-granular
    // input, is off the grid. Keep it listed so opening the sheet doesn't
    // misreport it as unset.
    const offGrid = {
      value: selected,
      label: formatTimeForDisplay(selected),
    };
    const at = grid.findIndex((option) => option.value > selected);
    return at === -1
      ? [...grid, offGrid]
      : [...grid.slice(0, at), offGrid, ...grid.slice(at)];
  }, [selected]);

  const commit = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          "w-full rounded-lg border border-zinc-200 px-3 py-3 bg-white flex-row items-center justify-between",
          disabled && "opacity-60",
        )}
      >
        <Text
          className={cn(
            "text-base",
            selected ? "text-zinc-900" : "text-zinc-500",
          )}
        >
          {selected ? formatTimeForDisplay(selected) : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={open} onClose={() => setOpen(false)}>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Clock size={18} color={colors.text.icon} />
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Pick a time
            </Text>
          </View>
          <TouchableOpacity onPress={() => setOpen(false)}>
            <Text className="text-blue-600" weight={FontWeight.Medium}>
              Close
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerClassName="pb-2"
          ref={(ref) => {
            if (!ref || !open) return;
            const index = options.findIndex(
              (option) => option.value === selected,
            );
            if (index < 0) return;
            requestAnimationFrame(() => {
              ref.scrollTo({
                y: Math.max(ROW_HEIGHT * (index - 1), 0),
                animated: false,
              });
            });
          }}
        >
          <BottomSheetOptionRow
            label={placeholder}
            active={selected === null}
            onPress={() => commit(null)}
          />
          {options.map((option) => (
            <BottomSheetOptionRow
              key={option.value}
              label={option.label}
              active={option.value === selected}
              onPress={() => commit(option.value)}
            />
          ))}
        </ScrollView>
      </FormModal>
    </View>
  );
}
