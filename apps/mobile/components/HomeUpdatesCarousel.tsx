import { useHomeActionUpdates } from "@alliance/shared/lib/useActionUpdates";
import { router } from "expo-router";
import { startTransition, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../lib/style/colors";
import HomeUpdateCard from "./HomeUpdateCard";
import Text, { FontWeight } from "./system/Text";

const DOT_SIZE = 8;
const CARD_INSET = 16;
const PAGE_RATIO = 0.86;
const ACTIVE_DOT_WIDTH = 20;

function Dot({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const width = useSharedValue(active ? ACTIVE_DOT_WIDTH : DOT_SIZE);
  useEffect(() => {
    width.value = withTiming(active ? ACTIVE_DOT_WIDTH : DOT_SIZE, {
      duration: 150,
    });
  }, [active, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 12, bottom: 12 }}
      className="h-6 px-1 items-center justify-center"
    >
      <Animated.View
        style={[
          style,
          {
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: active ? colors.text.icon : colors.text.disabled,
          },
        ]}
      />
    </Pressable>
  );
}

export default function HomeUpdatesCarousel() {
  const {
    query: { data, isLoading, isError },
    isNew,
    markOpened,
  } = useHomeActionUpdates();
  const updates = data ?? [];
  const reduceMotion = useReducedMotion();

  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, updates.length - 1));
  const page = Math.round(width * PAGE_RATIO);

  const scrollTarget = useRef<number | null>(null);

  const goTo = (target: number) => {
    if (target === index) return;
    scrollTarget.current = target;
    scrollRef.current?.scrollTo({ x: target * page, animated: !reduceMotion });
    startTransition(() => setSelected(target));
  };

  return (
    <View
      className="py-4 gap-3 bg-white"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View className="flex-row items-center justify-between px-4">
        <Text
          className="text-zinc-500"
          weight={FontWeight.Semibold}
          accessibilityRole="header"
        >
          Project updates
        </Text>
        <Pressable
          onPress={() => router.push("/action-updates")}
          accessibilityRole="link"
          className="min-h-11 justify-center px-1"
        >
          <Text className="text-green" weight={FontWeight.Medium}>
            See all
          </Text>
        </Pressable>
      </View>

      {isLoading && (
        <Text className="px-4 text-sm text-zinc-400">Loading updates…</Text>
      )}
      {isError && !isLoading && (
        <Text className="px-4 text-sm text-red-400">
          Could not load updates.
        </Text>
      )}
      {!isLoading && !isError && updates.length === 0 && (
        <Text className="px-4 text-sm text-zinc-400">
          No recent updates yet.
        </Text>
      )}

      {updates.length > 0 && width > 0 && (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled={Platform.OS === "web"}
            snapToInterval={Platform.OS === "web" ? undefined : page}
            decelerationRate="fast"
            disableIntervalMomentum
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: width - page }}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              scrollTarget.current = null;
            }}
            onScroll={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              // A scroll from the controls passes through the slides between,
              // so the selection waits for it to land.
              if (scrollTarget.current !== null) {
                if (Math.abs(x - scrollTarget.current * page) >= 1) return;
                scrollTarget.current = null;
              }
              const next = Math.round(x / page);
              if (next !== selected) setSelected(next);
            }}
          >
            {updates.map((update, position) => (
              <View
                key={update.id}
                style={{ width: page, paddingLeft: CARD_INSET }}
                accessibilityLabel={`Update ${position + 1} of ${updates.length}`}
                accessibilityElementsHidden={position !== index}
                importantForAccessibility={
                  position !== index ? "no-hide-descendants" : "auto"
                }
              >
                <HomeUpdateCard
                  update={update}
                  isNew={isNew(update.id)}
                  onOpen={markOpened}
                />
              </View>
            ))}
          </ScrollView>

          {updates.length > 1 && (
            <View className="flex-row items-center justify-center">
              {updates.map((update, position) => (
                <Dot
                  key={update.id}
                  active={position === index}
                  label={`Show update ${position + 1} of ${updates.length}`}
                  onPress={() => goTo(position)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
