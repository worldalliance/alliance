import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { View } from "react-native";
import {
  COMMITMENT_HEADLINE,
  COMMITMENT_NOTE,
  COMMUNITY_HEADLINE,
  MINUTES_HEADLINE,
  MINUTES_NOTE,
  NEXT_MILESTONE,
  priorities,
  PRIORITIES_NOTE,
  REACHED_MILESTONES,
  SCALE_HEADLINE,
  SCALE_NOTE,
} from "../../lib/onboarding/content";
import { motion, useOnboardingScale } from "../../lib/onboarding/scale";
import Text, { FontWeight } from "../system/Text";
import { Rise, StepHeadline, StepNote } from "./chrome";
import { CommitmentDeck } from "./graphics/CommitmentDeck";
import { GrowthMilestones } from "./graphics/GrowthMilestones";
import { HoursGrid } from "./graphics/HoursGrid";
import { PriorityCard } from "./graphics/PriorityCard";

export const COMMUNITY_REVEAL = {
  eyebrow: 0,
  headline: motion.narrativeStepMs,
  cards: motion.narrativeStepMs * 2,
  note: motion.narrativeStepMs * 3,
};

export function CommunityStep() {
  const scale = useOnboardingScale();

  return (
    <>
      <StepHeadline delayMs={COMMUNITY_REVEAL.headline}>
        {COMMUNITY_HEADLINE}
      </StepHeadline>
      <View className="min-h-0 flex-1" style={{ gap: scale.bodyGap }}>
        {/* Two rows that each take half the height, rather than a wrap: React
            Native has no grid, and wrapped cells never stretch. */}
        <Rise delayMs={COMMUNITY_REVEAL.cards} className="min-h-0 flex-1">
          <View className="min-h-0 flex-1 gap-3">
            {[priorities.slice(0, 2), priorities.slice(2)].map((row, i) => (
              <View key={i} className="min-h-0 flex-1 flex-row gap-3">
                {row.map((priority, column) => (
                  <PriorityCard
                    key={priority.id}
                    priority={priority}
                    index={i * 2 + column}
                  />
                ))}
              </View>
            ))}
          </View>
        </Rise>
        <StepNote delayMs={COMMUNITY_REVEAL.note}>{PRIORITIES_NOTE}</StepNote>
      </View>
    </>
  );
}

export function CommitmentStep() {
  const scale = useOnboardingScale();

  return (
    <>
      <StepHeadline>{COMMITMENT_HEADLINE}</StepHeadline>
      <View className="min-h-0 flex-1" style={{ gap: scale.noteGap }}>
        <Rise index={2} className="min-h-0 flex-1">
          <CommitmentDeck />
        </Rise>
        <StepNote>{COMMITMENT_NOTE}</StepNote>
      </View>
    </>
  );
}

export function MinutesStep() {
  const scale = useOnboardingScale();

  return (
    <>
      <StepHeadline>{MINUTES_HEADLINE}</StepHeadline>
      <View className="min-h-0 flex-1" style={{ gap: scale.bodyGap }}>
        <Rise index={2} className="min-h-0 flex-1">
          <HoursGrid />
        </Rise>
        <StepNote>{MINUTES_NOTE}</StepNote>
      </View>
    </>
  );
}

function NextMilestone() {
  const scale = useOnboardingScale();

  return (
    <View
      className="gap-1.5 rounded-lg bg-white/10"
      style={{ padding: scale.cardPad }}
    >
      <Text className="text-white/60" style={{ fontSize: scale.ui }}>
        At {NEXT_MILESTONE.members.toLocaleString("en-US")} members
      </Text>
      <Text
        weight={FontWeight.Medium}
        className="text-white"
        style={{ fontSize: scale.h2, lineHeight: scale.h2 * 1.2 }}
      >
        {NEXT_MILESTONE.action}
      </Text>
      <Text
        className="text-white/80"
        style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.35 }}
      >
        {NEXT_MILESTONE.body}
      </Text>
    </View>
  );
}

export function ScaleStep() {
  const scale = useOnboardingScale();
  const { data: memberCount } = useAllianceMemberCount();

  return (
    <>
      <StepHeadline>{SCALE_HEADLINE}</StepHeadline>
      {/* The track and the milestone read as one block, held clear of the
          headline above and the note below. */}
      <View style={{ gap: scale.gap }}>
        <View style={{ gap: scale.trackGap }}>
          <Rise index={2}>
            <GrowthMilestones
              near={REACHED_MILESTONES}
              members={memberCount ?? 0}
            />
          </Rise>
          <Rise index={3}>
            <NextMilestone />
          </Rise>
        </View>
        <StepNote index={4}>{SCALE_NOTE}</StepNote>
      </View>
    </>
  );
}
