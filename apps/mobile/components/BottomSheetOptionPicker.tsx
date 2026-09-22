import { matchesOptionSearch } from "@alliance/shared/forms/optionSearch";
import { cn } from "@alliance/shared/styles/util";
import {
  type PropsWithChildren,
  type RefObject,
  useEffect,
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
import Text, { FontWeight } from "./system/Text";

export type BottomSheetOption<V extends string | number> = {
  value: V;
  label: string;
};

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
      onContentSizeChange={(_, contentHeight) => {
        // Android retains its scroll offset when the content becomes empty.
        if (contentHeight === 0) {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        }
      }}
      style={{ maxHeight: (height - keyboardHeight) * 0.5 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
}

export default function BottomSheetOptionPicker<V extends string | number>({
  visible,
  searchable = false,
  onClose,
  title,
  options,
  value,
  onSelect,
}: BottomSheetOptionPickerProps<V>) {
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolledOnOpen = useRef(false);
  const [query, setQuery] = useState("");
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setQuery("");
  }
  useEffect(() => {
    if (!visible) hasScrolledOnOpen.current = false;
  }, [visible]);
  const filtered = searchable
    ? options.filter((option) => matchesOptionSearch(option, query))
    : options;

  const rows = filtered.map((option) => (
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
    <FormModal visible={visible} onClose={onClose}>
      <Text className="text-lg text-zinc-900 mb-2" weight={FontWeight.Semibold}>
        {title}
      </Text>
      {searchable && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Search options"
          placeholder="Search options…"
          placeholderTextColor={colors.text.light}
          autoCorrect={false}
          autoCapitalize="none"
          className="mb-2 rounded-lg border border-zinc-200 px-3 py-2 text-base text-zinc-900"
        />
      )}
      {searchable && filtered.length === 0 && (
        <Text className="py-3 text-zinc-500">No matches</Text>
      )}
      {searchable ? (
        <SearchableOptionList scrollRef={scrollRef}>
          {rows}
        </SearchableOptionList>
      ) : (
        rows
      )}
    </FormModal>
  );
}
