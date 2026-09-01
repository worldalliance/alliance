import {
  NO_TIME_LABEL,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, Clock } from "lucide-react-native";
import { ScrollView, TextInput, TouchableOpacity, View } from "react-native";
import { getTimeZone } from "react-native-localize";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

type Props = {
  value?: string;
  onChange?: (tz: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hour12?: boolean;
};

export function getDeviceTimeZone(): string {
  return getTimeZone();
}

export default function TimeZoneSelect({
  value,
  onChange,
  disabled,
  placeholder = "Select time zone…",
  hour12 = true,
}: Props) {
  const {
    filtered,
    selected,
    query,
    setQuery,
    setActiveIndex,
    commit,
    open,
    setOpen,
  } = useTimeZoneSelect({
    value,
    defaultValue: getDeviceTimeZone(),
    onChange,
    hour12,
    disabled,
  });

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          "w-full rounded-lg border px-3 py-3 bg-white flex-row items-center justify-between border-zinc-200",
          disabled && "opacity-60",
        )}
      >
        <View className="flex-1 pr-3">
          <Text className="text-base text-zinc-900" numberOfLines={1}>
            {selected.labelLeft || placeholder}
          </Text>
          <Text className="text-xs text-zinc-500 mt-0.5">
            {selected.timeLabel ?? NO_TIME_LABEL}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={open} onClose={() => setOpen(false)}>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Clock size={18} color="#0f172a" />
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Select time zone
            </Text>
          </View>
          <TouchableOpacity onPress={() => setOpen(false)}>
            <Text className="text-blue-600" weight={FontWeight.Medium}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
        <View className="border border-zinc-200 rounded-lg mb-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search time zones…"
            placeholderTextColor="#9ca3af"
            className="px-3 py-2 text-base text-zinc-900 focus:outline-none"
            autoFocus
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          contentContainerClassName="pb-2"
          ref={(ref) => {
            if (!ref || !open) return;
            const idx = filtered.findIndex((i) => i.tz === selected.tz);
            if (idx >= 0) {
              const approximateItemHeight = 55; // px
              const targetOffset = Math.max(
                approximateItemHeight * (idx - 1),
                0,
              );
              requestAnimationFrame(() => {
                ref.scrollTo({ y: targetOffset, animated: false });
              });
            }
          }}
        >
          {filtered.length === 0 ? (
            <Text className="text-zinc-500 p-3 text-center">No matches</Text>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = item.tz === selected.tz;
              return (
                <TouchableOpacity
                  key={item.tz}
                  activeOpacity={0.8}
                  onPress={() => commit(item.tz)}
                  onFocus={() => setActiveIndex(idx)}
                  className={cn(
                    "px-3 py-3 rounded-lg mb-2 border flex-row justify-between",
                    isSelected
                      ? "border-green-600 bg-green-50"
                      : "border-zinc-200 bg-white",
                  )}
                >
                  <Text className="text-base text-zinc-900">
                    {item.labelLeft}
                  </Text>
                  <Text className="text-xs text-zinc-600 mt-1 shrink-0">
                    {item.timeLabel ?? NO_TIME_LABEL}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </FormModal>
    </View>
  );
}
