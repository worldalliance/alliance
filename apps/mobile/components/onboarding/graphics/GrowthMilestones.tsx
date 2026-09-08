import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { Milestone } from "../../../lib/onboarding/content";
import { useOnboardingScale } from "../../../lib/onboarding/scale";
import Text from "../../system/Text";

/** Each bar waits for the one before it to finish, so the track fills in turn. */
const BAR_FILL_MS = 620;

/** How many whole-plus-fraction segments the current membership fills. */
function filledSegments(milestones: Milestone[], members: number) {
  let filled = 0;
  for (let i = 0; i < milestones.length; i++) {
    const from = i === 0 ? 0 : milestones[i - 1].members;
    const to = milestones[i].members;
    if (members >= to) {
      filled = i + 1;
      continue;
    }
    if (members > from) filled = i + (members - from) / (to - from);
    break;
  }
  return filled;
}

function Bar({
  fraction,
  index,
  height,
}: {
  fraction: number;
  index: number;
  height: number;
}) {
  const grown = useSharedValue(0);

  useEffect(() => {
    grown.value = withDelay(
      index * BAR_FILL_MS,
      withTiming(fraction, { duration: BAR_FILL_MS }),
    );
  }, [fraction, index, grown]);

  const style = useAnimatedStyle(() => ({
    width: `${grown.value * 100}%`,
  }));

  return (
    <View
      className="overflow-hidden rounded-[5px] bg-white/35"
      style={{ height }}
    >
      <Animated.View className="h-full rounded-[5px] bg-white" style={style} />
    </View>
  );
}

export function GrowthMilestones({
  near,
  members,
}: {
  near: Milestone[];
  members: number;
}) {
  const scale = useOnboardingScale();
  const progress = filledSegments(near, members);

  return (
    <View className="flex-row gap-3">
      {near.map((milestone, i) => (
        <View key={milestone.members} className="flex-1 gap-1">
          <Text
            className="text-right text-white"
            style={{ fontSize: scale.ui }}
          >
            {milestone.members.toLocaleString("en-US")}
            {i === 0 ? " members" : ""}
          </Text>
          <Bar
            fraction={Math.min(Math.max(progress - i, 0), 1)}
            index={i}
            height={scale.bar}
          />
          <Text
            className="text-right text-white"
            style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.2 }}
          >
            {milestone.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
