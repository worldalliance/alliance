import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";

const MEMBER_GOAL = 1_000;

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

  return (
    <div
      className={cn("flex w-full flex-col gap-3", toneText[tone], className)}
    >
      <p>
        {memberCount !== undefined
          ? `${memberCount.toLocaleString("en-US")} / ${MEMBER_GOAL.toLocaleString("en-US")} members`
          : isError
            ? "Member count unavailable"
            : "Loading member count..."}
      </p>
      <div
        role="progressbar"
        aria-label="Members toward the project launch"
        aria-valuemin={0}
        aria-valuemax={MEMBER_GOAL}
        aria-valuenow={
          memberCount !== undefined
            ? Math.min(memberCount, MEMBER_GOAL)
            : undefined
        }
        className={cn(
          "h-3 w-full overflow-hidden rounded-full",
          toneTrack[tone],
        )}
      >
        <div
          className="h-full rounded-full bg-green"
          style={{
            width: `${Math.min(((memberCount ?? 0) / MEMBER_GOAL) * 100, 100)}%`,
          }}
        />
      </div>
      {caption && <p>This project will run when we reach 1,000 members.</p>}
    </div>
  );
}
