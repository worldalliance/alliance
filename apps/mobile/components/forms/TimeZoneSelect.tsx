import {
  NO_TIME_LABEL,
  type TimeZoneSelectItem,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, Clock, Smartphone } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../lib/style/colors";
import { getDeviceTimeZone } from "../../lib/timeZone";
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

export default function TimeZoneSelect({
  value,
  onChange,
  disabled,
  placeholder = "Select time zone…",
  hour12 = true,
}: Props) {
  const deviceTimeZone = getDeviceTimeZone();
  const {
    filtered,
    selected,
    selectedIndex,
    deviceTz,
    query,
    setQuery,
    commit,
    open,
    setOpen,
    loading,
  } = useTimeZoneSelect({
    value,
    defaultValue: deviceTimeZone,
    onChange,
    hour12,
    disabled,
    deviceTimeZone,
  });
  const listRef = useRef<FlatList<TimeZoneSelectItem>>(null);
  // Every row holds one line of each text, so any one laid out gives the
  // height of all of them, and the list reaches the selected row without
  // rendering the rows before it.
  const [rowHeight, setRowHeight] = useState<number | null>(null);
  const [scroller] = useState(() =>
    createSelectedRowScroller({ getList: () => listRef.current }),
  );
  const scrollToSelected = () => scroller.scroll(selectedIndex);
  useEffect(() => {
    if (rowHeight === null) return;
    scroller.measured();
    scroller.scroll(selectedIndex);
  }, [rowHeight, scroller, selectedIndex]);

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
          <Text
            className="text-base text-zinc-900"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
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
          getItemLayout={
            rowHeight === null
              ? undefined
              : (_, index) => ({
                  length: rowHeight,
                  offset: rowHeight * index,
                  index,
                })
          }
          onLayout={scrollToSelected}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator
                className="p-3"
                color={colors.green}
                accessibilityLabel="Loading time zones"
              />
            ) : (
              <Text className="text-zinc-500 p-3 text-center">No matches</Text>
            )
          }
          renderItem={({ item }) => {
            const isSelected = item.tz === selected.tz;
            return (
              <View
                className="pb-2"
                onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => commit(item.tz)}
                  className={cn(
                    "px-3 py-3 rounded-lg border flex-row justify-between",
                    isSelected
                      ? "border-green-600 bg-green-50"
                      : "border-zinc-200 bg-white",
                  )}
                >
                  <View className="flex-1 pr-3">
                    {/* The city ends the name and tells apart the zones
                        sharing one, so the cut falls mid-name. */}
                    <Text
                      className="text-base text-zinc-900"
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {item.labelLeft}
                    </Text>
                    <Text className="text-xs text-zinc-500" numberOfLines={1}>
                      {item.labelSub ?? " "}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 mt-1 shrink-0">
                    {item.tz === deviceTz && (
                      <Smartphone
                        size={14}
                        color={colors.text.icon}
                        accessibilityLabel="Device time zone"
                      />
                    )}
                    <Text className="text-xs text-zinc-600">
                      {item.timeLabel ?? NO_TIME_LABEL}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </FormModal>
    </View>
  );
}
