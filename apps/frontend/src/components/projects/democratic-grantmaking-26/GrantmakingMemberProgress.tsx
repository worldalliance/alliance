import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";

const MEMBER_GOAL = 1_000;

export function GrantmakingMemberProgress({
  className,
}: {
  className?: string;
}) {
  const { data: memberCount, isError } = useAllianceMemberCount();

  return (
    <div className={cn("flex w-full flex-col gap-3 text-white/80", className)}>
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
        className="h-3 w-full overflow-hidden rounded-full bg-white/20"
      >
        <div
          className="h-full rounded-full bg-green"
          style={{
            width: `${Math.min(((memberCount ?? 0) / MEMBER_GOAL) * 100, 100)}%`,
          }}
        />
      </div>
      <p>This project will run when we reach 1,000 members.</p>
    </div>
  );
}
