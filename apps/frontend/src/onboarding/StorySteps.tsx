import { nextMilestone } from "@alliance/shared/lib/copy";
import { MilestoneKind, type Milestone } from "@alliance/shared/lib/milestones";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { priorities, PRIORITIES_NOTE } from "../site/content";
import {
  GrowthMilestones,
  MilestoneSize,
} from "../site/graphics/GrowthMilestones";
import { HoursGrid, HoursGridSize } from "../site/graphics/HoursGrid";
import { PriorityCard } from "../site/sections/Priorities";
import { riseStyle, StepHeadline, StepNote } from "./chrome";
import { CommitmentMocks } from "./graphics/CommitmentMocks";

export const COMMUNITY_HEADLINE =
  "We’re assembling a community that works together to combat global problems by committing 15 minutes every week.";

export const COMMITMENT_HEADLINE =
  "Members commit to weekly participation, which allows us to design projects with precision.";

export const COMMITMENT_NOTE = "Tap to explore";

export const MINUTES_HEADLINE =
  "Project tasks take about fifteen minutes of your week.";

export const MINUTES_NOTE =
  "You can complete the task at any time during the week.";

export const SCALE_HEADLINE =
  "The larger we are, the more impact we can have. Every new member is vital to us at this experimental stage.";

export const SCALE_NOTE =
  "Our work is advised by scientists, analysts, and other experts for rigor and effectiveness.";

/** The reachable half of the track, which is all onboarding shows. */
const REACHED_MILESTONES: Milestone[] = [
  {
    members: 30,
    label: "Jointly pitch the media on an underreported topic",
    kind: MilestoneKind.Completed,
  },
  {
    members: 100,
    label: "Encourage a small business to adopt a sustainability policy",
    kind: MilestoneKind.Completed,
  },
  {
    members: 300,
    label: "Conduct a large-scale citizen science project",
    kind: MilestoneKind.Completed,
  },
  {
    members: nextMilestone.members,
    label: nextMilestone.action,
    kind: MilestoneKind.Plan,
  },
];

export function CommunityStep() {
  return (
    <>
      <StepHeadline className="max-w-[58rem]">
        {COMMUNITY_HEADLINE}
      </StepHeadline>
      <div
        className="flex min-h-0 flex-1 flex-col lg:flex-none"
        style={{ gap: "clamp(0.5rem, 3vh, 2.4rem)" }}
      >
        <div
          className="ob-priorities ob-rise grid min-h-0 flex-1 grid-cols-2 gap-3 lg:h-[27vh] lg:flex-none lg:grid-cols-4"
          style={riseStyle(2)}
        >
          {priorities.map((priority, index) => (
            <PriorityCard
              key={priority.id}
              priority={priority}
              index={index}
              className="h-full min-h-0 rounded-lg"
            />
          ))}
        </div>
        <StepNote>{PRIORITIES_NOTE}</StepNote>
      </div>
    </>
  );
}

export function CommitmentStep() {
  return (
    <>
      <StepHeadline>{COMMITMENT_HEADLINE}</StepHeadline>
      <div
        className="flex min-h-0 flex-1 flex-col lg:flex-none"
        style={{ gap: "clamp(0.5rem, 2.4vh, 1.6rem)" }}
      >
        <div
          className="ob-rise flex min-h-0 flex-1 flex-col"
          style={riseStyle(2)}
        >
          <CommitmentMocks />
        </div>
        <StepNote className="lg:hidden">{COMMITMENT_NOTE}</StepNote>
      </div>
    </>
  );
}

export function MinutesStep() {
  return (
    <>
      <StepHeadline className="max-w-[52rem]">{MINUTES_HEADLINE}</StepHeadline>
      <div
        className="flex flex-col"
        style={{ gap: "clamp(0.5rem, 3vh, 2.4rem)" }}
      >
        <div className="ob-rise mx-auto w-full lg:w-[86%]" style={riseStyle(2)}>
          <HoursGrid size={HoursGridSize.Compact} />
        </div>
        <StepNote>{MINUTES_NOTE}</StepNote>
      </div>
    </>
  );
}

export function ScaleStep() {
  const { data: memberCount } = useAllianceMemberCount();

  return (
    <>
      <StepHeadline className="max-w-[58rem]">{SCALE_HEADLINE}</StepHeadline>
      <div
        className="mx-auto flex min-h-0 w-full flex-col lg:w-[81%] lg:flex-none"
        style={{ gap: "clamp(0.6rem, 2.6vh, 2rem)" }}
      >
        <div className="ob-rise flex min-h-0 flex-col" style={riseStyle(2)}>
          <GrowthMilestones
            near={REACHED_MILESTONES}
            members={memberCount ?? 0}
            size={MilestoneSize.Compact}
          />
        </div>
        <StepNote index={3}>{SCALE_NOTE}</StepNote>
      </div>
    </>
  );
}
