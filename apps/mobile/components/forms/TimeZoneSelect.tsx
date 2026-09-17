import {
  NO_TIME_LABEL,
  type TimeZoneSelectItem,
  useTimeZoneSelect,
} from "@alliance/shared/forms/timeZoneSelect";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, Clock } from "lucide-react-native";
import { useRef } from "react";
import { FlatList, TextInput, TouchableOpacity, View } from "react-native";
import { getTimeZone } from "react-native-localize";
import { colors } from "../../lib/style/colors";
import { lineHeightForWholePoints } from "../../lib/style/lineHeight";
import { useFontScale } from "../../lib/style/useFontScale";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";
import { timeZoneListWindow } from "./timeZoneListLayout";

// getItemLayout needs a row's height before layout, so both lines set their own
// line height instead of taking the font's. Source Sans 3's own are 22.5 and
// 17.2 at text-base and text-xs; these round up with a point or so to spare.
const NAME_LINE_HEIGHT = 24;
const SUB_LINE_HEIGHT = 19;
// A row's top and bottom borders, plus the space around its centered text.
const ROW_CHROME = 19;
const ROW_GAP = 8;
const LIST_MAX_HEIGHT = 420;

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

  const fontScale = useFontScale();
  const nameLineHeight = lineHeightForWholePoints({
    lineHeight: NAME_LINE_HEIGHT,
    fontScale,
  });
  const subLineHeight = lineHeightForWholePoints({
    lineHeight: SUB_LINE_HEIGHT,
    fontScale,
  });
  const rowHeight = ROW_CHROME + (nameLineHeight + subLineHeight) * fontScale;
  const rowSpan = rowHeight + ROW_GAP;
  const listWindow = timeZoneListWindow({
    selectedIndex: filtered.findIndex((i) => i.tz === selected.tz),
    rowCount: filtered.length,
    rowSpan,
    maxHeight: LIST_MAX_HEIGHT,
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
          <View className="flex-row mt-0.5">
            {selected.labelSub ? (
              // React Native defaults flexShrink to 0, and a zone listing ten
              // countries would push the clock off the row.
              <Text className="text-xs text-zinc-500 shrink" numberOfLines={1}>
                {selected.labelSub}
              </Text>
            ) : null}
            <Text className="text-xs text-zinc-500 shrink-0">
              {selected.labelSub ? " · " : ""}
              {selected.timeLabel ?? NO_TIME_LABEL}
            </Text>
          </View>
        </View>
        <ChevronDown size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={open} onClose={() => setOpen(false)} scrolls={false}>
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
            onChangeText={(text) => {
              setQuery(text);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
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
          style={{ maxHeight: listWindow.height }}
          contentContainerClassName="pb-2"
          getItemLayout={(_, index) => ({
            length: rowSpan,
            offset: rowSpan * index,
            index,
          })}
          initialScrollIndex={listWindow.firstRow}
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
                style={{ height: rowHeight, marginBottom: ROW_GAP }}
                className={cn(
                  "px-3 rounded-lg border flex-row items-center justify-between",
                  isSelected
                    ? "border-green-600 bg-green-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <View className="flex-1 pr-3">
                  <Text
                    className="text-base text-zinc-900"
                    style={{ lineHeight: nameLineHeight }}
                    numberOfLines={1}
                  >
                    {item.labelLeft}
                  </Text>
                  {item.labelSub ? (
                    <Text
                      className="text-xs text-zinc-500"
                      style={{ lineHeight: subLineHeight }}
                      numberOfLines={1}
                    >
                      {item.labelSub}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-xs text-zinc-600 shrink-0">
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
