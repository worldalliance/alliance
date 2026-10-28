import { cn } from "@alliance/shared/styles/util";
import { ProgressTrack, ProgressTrackSize } from "../../../site/ProgressTrack";
import { MEMBER_GOAL, MEMBER_GOAL_LABEL } from "./GrantmakingMemberProgress";

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
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg sm:text-xl text-[var(--site-ink)]/70">
        <span className="flex items-center gap-1">
          <span className="bg-green size-4 rounded-sm" aria-hidden />
          {members.toLocaleString("en-US")} members
        </span>
        <span className="flex items-center gap-1">
          <span className="size-4 rounded-sm bg-zinc-400" aria-hidden />
          {waitlist.toLocaleString("en-US")} waitlist
        </span>
        <span className="ml-auto">Goal: {MEMBER_GOAL_LABEL} members</span>
      </p>
      <ProgressTrack
        goal={MEMBER_GOAL}
        segments={[
          { count: members, className: "bg-green" },
          { count: waitlist, className: "bg-zinc-400" },
        ]}
        size={ProgressTrackSize.Page}
        label={`${members} members and ${waitlist} on the waitlist, toward ${MEMBER_GOAL.toLocaleString("en-US")}`}
      />
    </div>
  );
}
