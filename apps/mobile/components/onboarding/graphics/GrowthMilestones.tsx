import {
  filledSegments,
  milestoneKind,
  MilestoneKind,
  type Milestone,
} from "@alliance/shared/lib/milestones";
import { cn } from "@alliance/shared/styles/util";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useOnboardingScale } from "../../../lib/onboarding/scale";
import Text from "../../system/Text";

/** Each bar waits for the one before it to finish, so the track fills in turn. */
const BAR_FILL_MS = 620;

type KindPresentation = {
  bar: string;
  label: string;
  /** The plan gets a line to itself under the row of comparable bars. */
  ownRow: boolean;
  tag: string | null;
};

const KIND: Record<MilestoneKind, KindPresentation> = {
  [MilestoneKind.Example]: {
    bar: "bg-white/35",
    label: "max-w-[80%] self-end text-right text-white",
    ownRow: false,
    tag: null,
  },
  [MilestoneKind.Plan]: {
    bar: "border border-green/45 bg-green/12",
    label: "text-right text-white",
    ownRow: true,
    tag: "Plan",
  },
  [MilestoneKind.Completed]: {
    bar: "bg-white/35",
    label: "max-w-[80%] self-end text-right text-white",
    ownRow: false,
    tag: "Completed",
  },
};

function Bar({
  fraction,
  index,
  height,
  kind,
}: {
  fraction: number;
  index: number;
  height: number;
  kind: MilestoneKind;
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
      className={cn("overflow-hidden rounded-[5px]", KIND[kind].bar)}
      style={{ height }}
    >
      <Animated.View className="h-full rounded-[5px] bg-white" style={style} />
    </View>
  );
}

function Cell({
  milestone,
  fraction,
  index,
  showUnit,
}: {
  milestone: Milestone;
  fraction: number;
  index: number;
  showUnit: boolean;
}) {
  const scale = useOnboardingScale();
  const kindName = milestoneKind(milestone);
  const kind = KIND[kindName];

  return (
    <View className="gap-1">
      <Text className="text-right text-white" style={{ fontSize: scale.ui }}>
        {milestone.members.toLocaleString("en-US")}
        {showUnit ? " members" : ""}
      </Text>
      <Bar
        fraction={fraction}
        index={index}
        height={scale.bar}
        kind={kindName}
      />
      <Text
        className={kind.label}
        style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.2 }}
      >
        {milestone.label}
      </Text>
      {kind.tag && (
        <View className="flex-row items-center justify-end gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-green" />
          <Text
            className="uppercase text-white/70"
            style={{ fontSize: scale.caption }}
          >
            {kind.tag}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The example sizes read as a row of comparable bars. The plan takes the width
 * to itself underneath, which is what marks it as the one real commitment.
 */
export function GrowthMilestones({
  near,
  members,
}: {
  near: Milestone[];
  members: number;
}) {
  const scale = useOnboardingScale();
  const progress = filledSegments(near, members);

  const cells = near.map((milestone, index) => ({
    milestone,
    index,
    fraction: Math.min(Math.max(progress - index, 0), 1),
    showUnit: index === 0,
  }));

  const ownRow = (cell: (typeof cells)[number]) =>
    KIND[milestoneKind(cell.milestone)].ownRow;
  const examples = cells.filter((cell) => !ownRow(cell));
  const rows = cells.filter(ownRow);

  return (
    <View style={{ gap: scale.trackGap }}>
      <View className="flex-row gap-3">
        {examples.map((cell) => (
          <View key={cell.milestone.members} className="flex-1">
            <Cell {...cell} />
          </View>
        ))}
      </View>
      {rows.map((cell) => (
        <Cell key={cell.milestone.members} {...cell} />
      ))}
    </View>
  );
}
