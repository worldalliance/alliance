import { cn } from "@alliance/shared/styles/util";
import type { StyleWithVars } from "@alliance/sharedweb/ui/cssVars";
import type { ReactNode } from "react";
import type { Milestone } from "../content";
import { useInView } from "../hooks";

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

/** Each bar waits for the one before it to finish, so the track fills in turn. */
const BAR_FILL_MS = 620;

export enum MilestoneSize {
  Default = "default",
  /** For the onboarding panel, where the track shares a fixed height. */
  Compact = "compact",
}

const trackClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "flex flex-col gap-4 md:grid md:gap-2.5",
  [MilestoneSize.Compact]:
    "grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-[repeat(var(--milestone-count),minmax(0,1fr))] sm:gap-2",
};

const labelClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "text-sm md:text-base",
  [MilestoneSize.Compact]: "text-[length:var(--ob-ui)]",
};

const barClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "h-5 md:h-[30px]",
  [MilestoneSize.Compact]: "h-[clamp(0.85rem,2.7vh,2.1rem)]",
};

const captionClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "text-base",
  [MilestoneSize.Compact]: "text-[length:var(--ob-ui)]",
};

/* Eight compact cells overrun a phone, so the aspirational half waits for the
   width to show them. */
const farTrackClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "",
  [MilestoneSize.Compact]: "hidden sm:grid",
};

const rowGapClasses: Record<MilestoneSize, string> = {
  [MilestoneSize.Default]: "gap-7 sm:gap-14",
  [MilestoneSize.Compact]: "gap-[clamp(0.7rem,4.9vh,3.8rem)]",
};

function MilestoneTrack({
  milestones,
  members,
  inView,
  size,
  className,
  showUnit = false,
}: {
  milestones: Milestone[];
  members: number;
  inView: boolean;
  size: MilestoneSize;
  className?: string;
  /** Spells out the unit on the leading bar, so the rest read as counts. */
  showUnit?: boolean;
}) {
  const progress = filledSegments(milestones, members);

  // Compact stacks into two columns on a phone, so it takes its column count
  // from a variable the class picks up at `sm` instead of a fixed inline grid.
  const trackStyle: StyleWithVars =
    size === MilestoneSize.Compact
      ? { "--milestone-count": milestones.length }
      : {
          gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))`,
        };

  return (
    <div className={cn(trackClasses[size], className)} style={trackStyle}>
      {milestones.map((milestone, i) => (
        <div key={milestone.members} className="flex flex-col gap-1 md:gap-1.5">
          <p
            className={cn(
              "text-right text-white tabular-nums",
              labelClasses[size],
            )}
          >
            {milestone.members.toLocaleString("en-US")}
            {showUnit && i === 0 && " members"}
          </p>
          <div
            className={cn(
              "overflow-hidden rounded-[5px] bg-white/35",
              barClasses[size],
            )}
          >
            <div
              className="h-full origin-left rounded-[5px] bg-white ease-out"
              style={{
                transform: `scaleX(${inView ? Math.min(Math.max(progress - i, 0), 1) : 0})`,
                transitionProperty: "transform",
                transitionDuration: `${BAR_FILL_MS}ms`,
                transitionDelay: `${i * BAR_FILL_MS}ms`,
              }}
            />
          </div>
          <p
            className={cn(
              "text-right leading-tight text-white",
              captionClasses[size],
            )}
          >
            {milestone.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export function GrowthMilestones({
  footnote,
  near,
  far,
  members,
  footer,
  className,
  size = MilestoneSize.Default,
}: {
  /** Omitted where the track stands on its own, as in onboarding. */
  footnote?: string;
  near: Milestone[];
  /** Omitted where only the reachable half is wanted, as in onboarding. */
  far?: Milestone[];
  members: number;
  footer?: ReactNode;
  className?: string;
  size?: MilestoneSize;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);

  return (
    <div
      ref={ref}
      className={cn("flex flex-col", rowGapClasses[size], className)}
    >
      <MilestoneTrack
        milestones={near}
        members={members}
        inView={inView}
        size={size}
        showUnit
      />
      {far && (
        <MilestoneTrack
          milestones={far}
          members={0}
          inView={inView}
          size={size}
          className={farTrackClasses[size]}
        />
      )}
      {(footnote || footer) && (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          {footnote && (
            <p className="max-w-[52rem] text-sm md:text-base leading-snug text-white/80">
              {footnote}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
