import { cn } from "@alliance/shared/styles/util";
import { MEMBER_GOAL, MEMBER_GOAL_LABEL } from "./GrantmakingMemberProgress";

const share = (count: number) =>
  `${(Math.min(count, MEMBER_GOAL) / MEMBER_GOAL) * 100}%`;

export function MemberWaitlistBar({
  members,
  waitlist,
  className,
}: {
  members: number;
  waitlist: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "site-sans flex flex-col-reverse gap-2 lg:flex-col",
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/80">
        <span className="flex items-center gap-1">
          <span className="bg-green size-3 rounded-[2px]" aria-hidden />
          {members.toLocaleString("en-US")} Members
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-[2px] bg-white" aria-hidden />
          {waitlist.toLocaleString("en-US")} Waitlist
        </span>
        <span className="ml-auto">Goal: {MEMBER_GOAL_LABEL} members</span>
      </p>
      <div
        role="img"
        aria-label={`${members} members and ${waitlist} on the waitlist, toward ${MEMBER_GOAL.toLocaleString("en-US")}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-white/20"
      >
        <div
          className="bg-green h-full rounded-l-full"
          style={{ width: share(members) }}
        />
        <div
          className="h-full rounded-r-full bg-white"
          style={{
            width: share(
              Math.min(waitlist, Math.max(0, MEMBER_GOAL - members)),
            ),
          }}
        />
      </div>
    </div>
  );
}
