import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useMediaQuery } from "../lib/useMediaQuery";
import { priorities, PRIORITIES_NOTE, type Milestone } from "../site/content";
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
  "Members commit to weekly participation, which allows us to plan actions in advance.";

export const COMMITMENT_NOTE = "Tap to explore";

export const MINUTES_HEADLINE =
  "Every action takes about fifteen minutes of your week.";

export const MINUTES_NOTE =
  "You can complete the action at any time during the week.";

export const SCALE_HEADLINE =
  "The larger we are, the more impact we can have. Every new member is vital to us at this experimental stage.";

export const SCALE_NOTE =
  "Our work is advised by scientists, analysts, and other experts for rigor and effectiveness.";

/** The reachable half of the track, which is all onboarding shows. */
const REACHED_MILESTONES: Milestone[] = [
  { members: 30, label: "Jointly pitch the media on an underreported topic" },
  {
    members: 100,
    label: "Encourage a small business to adopt a sustainability policy",
  },
  { members: 300, label: "Conduct a large-scale citizen science project" },
];

/** Three bars crush a phone, so the one already behind us drops off there. */
const WIDE_TRACK_QUERY = "(min-width: 1024px)";

const NEXT_MILESTONE = {
  members: 1000,
  action: "Be a committed test audience for a green product alternative",
  body: "A thousand people who all turn up in the same week is something a company can plan around. It is enough to give a greener product an honest launch: reviews at volume, a first market nobody had to buy, and evidence the demand was there all along.",
};

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
        className="flex min-h-0 flex-1 flex-col lg:flex-none"
        style={{ gap: "clamp(0.5rem, 3vh, 2.4rem)" }}
      >
        <div
          className="ob-rise mx-auto flex min-h-0 w-full flex-1 flex-col lg:w-[86%] lg:flex-none"
          style={riseStyle(2)}
        >
          <HoursGrid size={HoursGridSize.Compact} />
        </div>
        <StepNote>{MINUTES_NOTE}</StepNote>
      </div>
    </>
  );
}

function NextMilestone() {
  return (
    <div className="mx-auto flex w-full max-w-[38rem] flex-col gap-1.5 rounded-lg bg-white/10 p-[clamp(0.8rem,2.2vh,1.5rem)]">
      <p className="text-[length:var(--ob-ui)] text-white/60">
        At {NEXT_MILESTONE.members.toLocaleString("en-US")} members
      </p>
      <p className="text-[length:var(--ob-h2)] leading-tight font-medium text-balance text-white">
        {NEXT_MILESTONE.action}
      </p>
      <p className="text-[length:var(--ob-ui)] leading-snug text-pretty text-white/80">
        {NEXT_MILESTONE.body}
      </p>
    </div>
  );
}

export function ScaleStep() {
  const { data: memberCount } = useAllianceMemberCount();
  const wideTrack = useMediaQuery(WIDE_TRACK_QUERY);

  return (
    <>
      <StepHeadline className="max-w-[58rem]">{SCALE_HEADLINE}</StepHeadline>
      <div
        className="mx-auto flex min-h-0 w-full flex-col lg:w-[81%] lg:flex-none"
        style={{ gap: "clamp(0.6rem, 2.6vh, 2rem)" }}
      >
        <div className="ob-rise min-h-0" style={riseStyle(2)}>
          <GrowthMilestones
            near={wideTrack ? REACHED_MILESTONES : REACHED_MILESTONES.slice(1)}
            members={memberCount ?? 0}
            size={MilestoneSize.Compact}
          />
        </div>
        <div className="ob-rise" style={riseStyle(3)}>
          <NextMilestone />
        </div>
        <StepNote index={4}>{SCALE_NOTE}</StepNote>
      </div>
    </>
  );
}
