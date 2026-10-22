import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ACTION_EXAMPLES } from "../../../lib/onboarding/actionExamples";
import { ActionExampleCard } from "./ActionExampleCard";

/** How far back each card behind the front one sits. */
const STEP_Y = 14;
const SCALE_STEP = 0.05;

function DeckCard({
  depth,
  children,
}: {
  depth: number;
  children: React.ReactNode;
}) {
  const offset = useSharedValue(depth);

  useEffect(() => {
    offset.value = withTiming(depth, { duration: 500 });
  }, [depth, offset]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.value * STEP_Y },
      { scale: 1 - offset.value * SCALE_STEP },
    ],
  }));

  return (
    <Animated.View
      className="absolute inset-x-0 top-0 bottom-0 rounded-lg"
      style={[
        style,
        {
          zIndex: ACTION_EXAMPLES.length - depth,
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The three actions as a deck: tapping the front card sends it to the back and
 * brings the next one up, so a phone reaches all three without scrolling.
 */
export function CommitmentDeck() {
  const [order, setOrder] = useState(ACTION_EXAMPLES.map((_, i) => i));

  const cycle = () => setOrder(([first, ...rest]) => [...rest, first]);

  return (
    <Pressable
      onPress={cycle}
      accessibilityLabel="Show the next action"
      className="min-h-0 flex-1"
      style={{ marginBottom: STEP_Y * (ACTION_EXAMPLES.length - 1) }}
    >
      <View className="min-h-0 flex-1">
        {ACTION_EXAMPLES.map((action, index) => (
          <DeckCard key={action.id} depth={order.indexOf(index)}>
            <ActionExampleCard action={action} />
          </DeckCard>
        ))}
      </View>
    </Pressable>
  );
}
