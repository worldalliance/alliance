import { cn } from "@alliance/shared/styles/util";
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

function MilestoneTrack({
  milestones,
  members,
  inView,
  showUnit = false,
}: {
  milestones: Milestone[];
  members: number;
  inView: boolean;
  /** Spells out the unit on the leading bar, so the rest read as counts. */
  showUnit?: boolean;
}) {
  const progress = filledSegments(milestones, members);

  return (
    <div
      className="flex flex-col gap-4 md:grid md:gap-2.5"
      style={{
        gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))`,
      }}
    >
      {milestones.map((milestone, i) => (
        <div key={milestone.members} className="flex flex-col gap-1 md:gap-1.5">
          <p className="text-xs text-white tabular-nums md:text-right md:text-sm">
            {milestone.members.toLocaleString("en-US")}
            {showUnit && i === 0 && " members"}
          </p>
          <div className="h-5 overflow-hidden rounded-[5px] bg-white/35 md:h-[30px]">
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
          <p className="text-[0.85rem] leading-tight text-white md:text-right md:text-sm">
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
}: {
  footnote: string;
  near: Milestone[];
  far: Milestone[];
  members: number;
  footer?: ReactNode;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);

  return (
    <div ref={ref} className={cn("flex flex-col gap-7 sm:gap-14", className)}>
      <MilestoneTrack
        milestones={near}
        members={members}
        inView={inView}
        showUnit
      />
      <MilestoneTrack milestones={far} members={0} inView={inView} />
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <p className="max-w-[52rem] text-[0.95rem] leading-snug text-white/80">
          {footnote}
        </p>
        {footer}
      </div>
    </div>
  );
}
