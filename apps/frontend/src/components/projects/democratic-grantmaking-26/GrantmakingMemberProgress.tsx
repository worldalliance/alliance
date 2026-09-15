import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";

const MEMBER_GOAL = 1_000;

export const MEMBER_GOAL_LABEL = MEMBER_GOAL.toLocaleString("en-US");

export enum ProgressTone {
  /** White type over the grass photo. */
  OnPhoto = "on-photo",
  /** Dark type inside the platform mockup. */
  OnCard = "on-card",
}

const toneText: Record<ProgressTone, string> = {
  [ProgressTone.OnPhoto]: "text-white/80",
  [ProgressTone.OnCard]: "text-zinc-600",
};

const toneTrack: Record<ProgressTone, string> = {
  [ProgressTone.OnPhoto]: "bg-white/20",
  [ProgressTone.OnCard]: "bg-zinc-200",
};

export function GrantmakingMemberProgress({
  className,
  tone = ProgressTone.OnPhoto,
  caption = true,
}: {
  className?: string;
  tone?: ProgressTone;
  /** Off where the row beside the bar already says what the goal is. */
  caption?: boolean;
}) {
  const { data: memberCount, isError } = useAllianceMemberCount();
  const cappedCount = Math.min(memberCount ?? 0, MEMBER_GOAL);

  return (
    <div
      className={cn("flex w-full flex-col gap-3", toneText[tone], className)}
    >
      <p>
        {memberCount !== undefined
          ? `${memberCount.toLocaleString("en-US")} / ${MEMBER_GOAL_LABEL} members`
          : isError
            ? "Member count unavailable"
            : "Loading member count..."}
      </p>
      <CompletedBar
        role="progressbar"
        aria-label="Members toward the project launch"
        aria-valuemin={0}
        aria-valuemax={MEMBER_GOAL}
        aria-valuenow={memberCount !== undefined ? cappedCount : undefined}
        className={cn("mt-0", toneTrack[tone])}
        percentage={(cappedCount / MEMBER_GOAL) * 100}
      />
      {caption && (
        <p>This project will run when we reach {MEMBER_GOAL_LABEL} members.</p>
      )}
    </div>
  );
}
