import {
  NO_TIME_LABEL,
  type TimeZoneSelectItem,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, Clock } from "lucide-react-native";
import { useRef, useState } from "react";
import { FlatList, TextInput, TouchableOpacity, View } from "react-native";
import { getTimeZone } from "react-native-localize";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";
import { createSelectedRowScroller } from "./selectedRowScroller";

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
  const listRef = useRef<FlatList<TimeZoneSelectItem>>(null);
  const [reaching, setReaching] = useState(false);
  const [scroller] = useState(() =>
    createSelectedRowScroller({
      getList: () => listRef.current,
      onLanded: () => setReaching(false),
    }),
  );
  const selectedIndex = filtered.findIndex((i) => i.tz === selected.tz);
  const scrollToSelected = () => scroller.scroll(selectedIndex);

  // The trigger has one line under the name, so the label shares it with the
  // clock.
  const underName = [selected.labelSub, selected.timeLabel ?? NO_TIME_LABEL]
    .filter(Boolean)
    .join(" · ");

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => {
          scroller.open();
          setReaching(true);
          setOpen(true);
          // iOS keeps the list mounted through the modal's fade-out, so a
          // reopen before it ends lays out nothing new.
          scrollToSelected();
        }}
        className={cn(
          "w-full rounded-lg border px-3 py-3 bg-white flex-row items-center justify-between border-zinc-200",
          disabled && "opacity-60",
        )}
      >
        <View className="flex-1 pr-3">
          <Text className="text-base text-zinc-900" numberOfLines={1}>
            {selected.labelLeft || placeholder}
          </Text>
          <Text className="text-xs text-zinc-500 mt-0.5" numberOfLines={1}>
            {underName}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal
        visible={open}
        onClose={() => setOpen(false)}
        scrollable={false}
      >
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
            onChangeText={(q) => {
              scroller.cancel();
              setReaching(false);
              setQuery(q);
            }}
            placeholder="Search time zones…"
            placeholderTextColor="#9ca3af"
            className="px-3 py-2 text-base text-zinc-900 focus:outline-none"
            autoFocus
          />
        </View>
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.tz}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          contentContainerClassName="pb-2"
          // The list ends at the last row it has measured, so rendering every
          // row up to the selected one lets the open reach it in one scroll
          // rather than a screen per retry. The list keeps its first
          // initialNumToRender rows mounted, so the count drops once the
          // scroll lands or the member types.
          initialNumToRender={
            reaching ? Math.max(10, selectedIndex + 10) : undefined
          }
          onLayout={scrollToSelected}
          onScrollToIndexFailed={scroller.failed}
          ListEmptyComponent={
            <Text className="text-zinc-500 p-3 text-center">No matches</Text>
          }
          renderItem={({ item, index }) => {
            const isSelected = item.tz === selected.tz;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => commit(item.tz)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "px-3 py-3 rounded-lg mb-2 border flex-row justify-between",
                  isSelected
                    ? "border-green-600 bg-green-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base text-zinc-900">
                    {item.labelLeft}
                  </Text>
                  {item.labelSub ? (
                    <Text className="text-xs text-zinc-500">
                      {item.labelSub}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-xs text-zinc-600 mt-1 shrink-0">
                  {item.timeLabel ?? NO_TIME_LABEL}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </FormModal>
    </View>
  );
}
