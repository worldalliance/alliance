import type { OptionCategory } from "@alliance/common/forms/options-schema";
import { markdownPlainText } from "@alliance/shared/forms/optionSearch";
import {
  filterOptionSections,
  type OptionSection,
  optionSections,
} from "@alliance/shared/forms/optionSections";
import { cn } from "@alliance/shared/styles/util";
import { X } from "lucide-react-native";
import {
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LayoutChangeEvent,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useKeyboardState,
  useWindowDimensions,
} from "react-native-keyboard-controller";
import { colors } from "../lib/style/colors";
import FormModal from "./forms/FormModal";
import Checkbox, { CheckboxSize } from "./system/Checkbox";
import Text, { FontWeight } from "./system/Text";

export type BottomSheetOption<V extends string | number> = {
  value: V;
  label: string;
  category?: string;
};

function OptionCategoryHeading({ name }: { name: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="pt-3 pb-1 text-xs uppercase tracking-wide text-zinc-500"
      weight={FontWeight.Semibold}
    >
      {name}
    </Text>
  );
}

// Headings and rows share one flat list so a row's layout y is its offset in
// the scroll content, which scroll-to-selection relies on.
export function sectionedRows<O>(
  sections: OptionSection<O>[],
  renderRow: (option: O) => ReactNode,
): ReactNode[] {
  return sections.flatMap(({ category, items }) => [
    category && (
      <OptionCategoryHeading
        key={`category:${category.id}`}
        name={category.name}
      />
    ),
    ...items.map(renderRow),
  ]);
}

export function BottomSheetOptionRow({
  label,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLayout={onLayout}
      activeOpacity={0.7}
      className="py-3 flex-row items-center"
    >
      <View
        className={cn(
          "w-5 h-5 rounded-full border mr-3 items-center justify-center",
          active ? "border-green" : "border-zinc-300",
        )}
      >
        {active && <View className="w-2.5 h-2.5 rounded-full bg-green" />}
      </View>
      <Text className="text-base text-zinc-800">{label}</Text>
    </TouchableOpacity>
  );
}

interface BottomSheetOptionPickerProps<V extends string | number> {
  visible: boolean;
  searchable?: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption<V>[];
  categories?: OptionCategory[];
  value: V | null | undefined;
  onSelect: (value: V) => void;
}

function SearchableOptionList({
  children,
  scrollRef,
}: PropsWithChildren<{ scrollRef: RefObject<ScrollView | null> }>) {
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) => state.height);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ maxHeight: (height - keyboardHeight) * 0.5 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
}

function useQueryResetOnOpen(visible: boolean) {
  const [query, setQuery] = useState("");
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setQuery("");
  }
  return [query, setQuery] as const;
}

function OptionSearch({
  query,
  onChangeQuery,
  empty,
}: {
  query: string;
  onChangeQuery: (query: string) => void;
  empty: boolean;
}) {
  return (
    <>
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        accessibilityLabel="Search options"
        placeholder="Search options…"
        placeholderTextColor={colors.text.light}
        autoCorrect={false}
        autoCapitalize="none"
        className="mb-2 rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900"
      />
      {empty && <Text className="py-3 text-zinc-500">No matches</Text>}
    </>
  );
}

function OptionSheet({
  visible,
  onClose,
  title,
  search,
  scrollRef,
  showCloseButton = false,
  children,
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  search?: Parameters<typeof OptionSearch>[0];
  scrollRef: RefObject<ScrollView | null>;
  showCloseButton?: boolean;
}>) {
  return (
    <FormModal visible={visible} onClose={onClose}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
          {title}
        </Text>
        {showCloseButton && (
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="p-1"
          >
            <X size={20} color={colors.text.icon} />
          </TouchableOpacity>
        )}
      </View>
      {search ? (
        <>
          <OptionSearch
            {...search}
            onChangeQuery={(query) => {
              search.onChangeQuery(query);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          />
          <SearchableOptionList scrollRef={scrollRef}>
            {children}
          </SearchableOptionList>
        </>
      ) : (
        children
      )}
    </FormModal>
  );
}

export default function BottomSheetOptionPicker<V extends string | number>({
  visible,
  searchable = false,
  onClose,
  title,
  options,
  categories,
  value,
  onSelect,
}: BottomSheetOptionPickerProps<V>) {
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolledOnOpen = useRef(false);
  const [query, setQuery] = useQueryResetOnOpen(visible);
  useEffect(() => {
    if (!visible) hasScrolledOnOpen.current = false;
  }, [visible]);
  const sections = useMemo(
    () => optionSections({ options, categories }),
    [options, categories],
  );
  const filtered = searchable
    ? filterOptionSections(sections, { query, text: (option) => option.label })
    : sections;

  const rows = sectionedRows(filtered, (option) => (
    <BottomSheetOptionRow
      key={String(option.value)}
      label={option.label}
      active={value === option.value}
      onLayout={
        searchable && visible && !query && value === option.value
          ? ({ nativeEvent }) => {
              if (hasScrolledOnOpen.current) return;
              hasScrolledOnOpen.current = true;
              const { y } = nativeEvent.layout;
              requestAnimationFrame(() => {
                scrollRef.current?.scrollTo({ y, animated: false });
              });
            }
          : undefined
      }
      onPress={() => {
        onSelect(option.value);
        onClose();
      }}
    />
  ));

  return (
    <OptionSheet
      visible={visible}
      onClose={onClose}
      title={title}
      search={
        searchable
          ? { query, onChangeQuery: setQuery, empty: filtered.length === 0 }
          : undefined
      }
      scrollRef={scrollRef}
    >
      {rows}
    </OptionSheet>
  );
}

export function BottomSheetMultiOptionPicker({
  visible,
  searchable = false,
  onClose,
  title,
  options,
  categories,
  values,
  maxReached,
  onToggle,
}: {
  visible: boolean;
  searchable?: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption<string>[];
  categories?: OptionCategory[];
  values: string[];
  maxReached: boolean;
  onToggle: (params: { value: string; selected: boolean }) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useQueryResetOnOpen(visible);
  const sections = useMemo(
    () =>
      optionSections({
        options: options.map((option) => ({
          ...option,
          text: markdownPlainText(option.label),
        })),
        categories,
      }),
    [options, categories],
  );
  const filtered = searchable
    ? filterOptionSections(sections, { query, text: (item) => item.text })
    : sections;

  const rows = sectionedRows(filtered, (option) => {
    const checked = values.includes(option.value);
    return (
      <Checkbox
        key={option.value}
        checked={checked}
        disabled={!checked && maxReached}
        label={option.label}
        size={CheckboxSize.Small}
        className="py-3"
        onChange={(selected) => onToggle({ value: option.value, selected })}
      />
    );
  });

  return (
    <OptionSheet
      visible={visible}
      onClose={onClose}
      title={title}
      search={
        searchable
          ? { query, onChangeQuery: setQuery, empty: filtered.length === 0 }
          : undefined
      }
      scrollRef={scrollRef}
      showCloseButton
    >
      {rows}
    </OptionSheet>
  );
}
