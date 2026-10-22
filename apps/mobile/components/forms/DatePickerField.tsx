import { formatMediumDate } from "@alliance/shared/lib/dateFormatters";
import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

const CALENDAR_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function DatePickerField({
  label,
  value,
  onChange,
  lightLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lightLabel?: boolean;
  disabled?: boolean;
}) {
  const selectedDate = new Date(`${value}T12:00:00`);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const firstWeekday = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();

  const openPicker = () => {
    setVisibleMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
    setPickerOpen(true);
  };

  const changeMonth = (offset: number) => {
    setVisibleMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
  };

  const selectDate = (date: Date) => {
    onChange(dateToInputValue(date));
    setPickerOpen(false);
  };

  return (
    <View>
      <Text
        className={
          lightLabel
            ? "text-xs text-white/70 mb-1"
            : "text-sm text-zinc-700 mb-2"
        }
        weight={FontWeight.Semibold}
      >
        {label}
      </Text>
      <TouchableOpacity
        className="min-h-11 rounded-lg border border-zinc-200 bg-white px-3 flex-row items-center justify-between"
        accessibilityRole="button"
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        disabled={disabled}
        onPress={openPicker}
      >
        <Text className="text-base text-zinc-700">
          {formatMediumDate(selectedDate)}
        </Text>
        <CalendarDays size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl" weight={FontWeight.Semibold}>
              Select {label.toLowerCase()}
            </Text>
            <TouchableOpacity
              className="px-2 py-1"
              accessibilityRole="button"
              onPress={() => setPickerOpen(false)}
            >
              <Text style={{ color: colors.green }} weight={FontWeight.Medium}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => changeMonth(-1)}
            >
              <ChevronLeft size={22} color={colors.text.icon} />
            </TouchableOpacity>
            <Text className="text-lg" weight={FontWeight.Semibold}>
              {visibleMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => changeMonth(1)}
            >
              <ChevronRight size={22} color={colors.text.icon} />
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap">
            {CALENDAR_WEEKDAYS.map((weekday, index) => (
              <View
                key={`${weekday}-${index}`}
                className="h-8 items-center justify-center"
                style={{ width: "14.2857%" }}
              >
                <Text
                  className="text-xs text-zinc-500"
                  weight={FontWeight.Semibold}
                >
                  {weekday}
                </Text>
              </View>
            ))}
            {Array.from({ length: firstWeekday }, (_, index) => (
              <View
                key={`empty-${index}`}
                className="h-11"
                style={{ width: "14.2857%" }}
              />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
              );
              const dateValue = dateToInputValue(date);
              const selected = dateValue === value;

              return (
                <View
                  key={dateValue}
                  className="h-11 items-center justify-center"
                  style={{ width: "14.2857%" }}
                >
                  <TouchableOpacity
                    className={
                      selected
                        ? "w-10 h-10 rounded-full items-center justify-center bg-green"
                        : "w-10 h-10 rounded-full items-center justify-center"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={formatMediumDate(date)}
                    accessibilityState={{ selected }}
                    onPress={() => selectDate(date)}
                  >
                    <Text
                      className={selected ? "text-white" : "text-zinc-800"}
                      weight={
                        selected ? FontWeight.Semibold : FontWeight.Regular
                      }
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Button
            title="Today"
            color={ButtonColor.Outline}
            onPress={() => selectDate(new Date())}
          />
        </View>
      </FormModal>
    </View>
  );
}
