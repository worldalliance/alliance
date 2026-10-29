import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import {
  createContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { colors } from "../../lib/style/colors";
import KeyboardAwareScrollView from "../KeyboardAwareScrollView";
import Text, { FontWeight } from "../system/Text";
import { pinnedSection } from "./pinnedSection";

/** An open accordion section, in the scroll content's coordinates. */
export type OpenSection = {
  key: string;
  title: string;
  top: number;
  bottom: number;
  close: () => void;
};

type StickyAccordionValue = {
  contentRef: RefObject<View | null>;
  /** Bumps when the content resizes, so sections measure again. */
  layoutVersion: number;
  report: (section: OpenSection) => void;
  remove: (key: string) => void;
};

/** An accordion section's title row; the pinned copy reuses it so the two look identical. */
export function AccordionTitleBar({
  title,
  isOpen,
  onPress,
  accessibilityLabel,
  className,
  style,
  onLayout,
}: {
  title: string;
  isOpen: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        "flex-row items-center justify-between gap-3 py-3",
        className,
      )}
      style={style}
      onLayout={onLayout}
    >
      <Text className="flex-1 text-zinc-900" weight={FontWeight.Medium}>
        {title}
      </Text>
      {isOpen ? (
        <ChevronUp size={18} color={colors.text.icon} />
      ) : (
        <ChevronDown size={18} color={colors.text.icon} />
      )}
    </TouchableOpacity>
  );
}

/** Present only inside `StickyAccordionScrollView`. */
export const StickyAccordionContext =
  createContext<StickyAccordionValue | null>(null);

/**
 * A keyboard-aware scroll view that pins the title of the open accordion
 * section the member has scrolled into, so they can close it from anywhere in
 * the section. The pinned bar assumes content inset 16 horizontally and not at
 * all from the top.
 */
export function StickyAccordionScrollView({
  children,
  onScroll,
  onContentSizeChange,
  ...scrollProps
}: KeyboardAwareScrollViewProps & { children: ReactNode }) {
  const contentRef = useRef<View>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const sections = useRef(new Map<string, OpenSection>());
  const scrollY = useRef(0);
  const barHeight = useRef(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [pinned, setPinned] = useState<OpenSection | null>(null);

  const updatePinned = () => {
    const next = pinnedSection({
      sections: sections.current.values(),
      scrollY: scrollY.current,
      barHeight: barHeight.current,
    });
    setPinned((current) =>
      current?.key === next?.key && current?.top === next?.top ? current : next,
    );
  };

  const value = useMemo<StickyAccordionValue>(
    () => ({
      contentRef,
      layoutVersion,
      report: (section) => {
        sections.current.set(section.key, section);
        updatePinned();
      },
      remove: (key) => {
        sections.current.delete(key);
        updatePinned();
      },
    }),
    [layoutVersion],
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    updatePinned();
    onScroll?.(event);
  };

  return (
    <StickyAccordionContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          {...scrollProps}
          ref={scrollRef}
          onScroll={handleScroll}
          onContentSizeChange={(width, height) => {
            setLayoutVersion((v) => v + 1);
            onContentSizeChange?.(width, height);
          }}
        >
          <View ref={contentRef}>{children}</View>
        </KeyboardAwareScrollView>
        {pinned ? (
          <AccordionTitleBar
            title={pinned.title}
            isOpen
            onPress={() => {
              scrollRef.current?.scrollTo({ y: pinned.top, animated: false });
              pinned.close();
            }}
            accessibilityLabel={`Collapse ${pinned.title}`}
            className="absolute left-0 right-0 top-0 border-b border-zinc-200 bg-white px-4"
            style={{ boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)" }}
            onLayout={(event) => {
              barHeight.current = event.nativeEvent.layout.height;
              updatePinned();
            }}
          />
        ) : null}
      </View>
    </StickyAccordionContext.Provider>
  );
}
