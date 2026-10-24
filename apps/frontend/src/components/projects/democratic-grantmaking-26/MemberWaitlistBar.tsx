import { cn } from "@alliance/shared/styles/util";
import { MEMBER_GOAL } from "./GrantmakingMemberProgress";

export function MemberWaitlistBar({
  members,
  waitlist,
  goal = MEMBER_GOAL,
  className,
}: {
  members: number;
  waitlist: number;
  goal?: number;
  className?: string;
}) {
  const share = (count: number) => `${(Math.min(count, goal) / goal) * 100}%`;
  return (
    <div
      className={cn(
        "site-sans flex flex-col-reverse gap-2 lg:flex-col",
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base sm:text-lg text-[var(--site-ink)]/70">
        <span className="flex items-center gap-1">
          <span className="bg-green size-3 rounded-[2px]" aria-hidden />
          {members.toLocaleString("en-US")} members
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-[2px] bg-zinc-400" aria-hidden />
          {waitlist.toLocaleString("en-US")} waitlist
        </span>
        <span className="ml-auto">
          Goal: {goal.toLocaleString("en-US")} members
        </span>
      </p>
      <div
        role="img"
        aria-label={`${members} members and ${waitlist} on the waitlist, toward ${goal.toLocaleString("en-US")}`}
        className="flex h-5 w-full overflow-hidden rounded-full bg-zinc-100"
      >
        <div
          className="bg-green h-full rounded-l-full"
          style={{ width: share(members) }}
        />
        <div
          className="h-full rounded-r-full bg-zinc-400"
          style={{
            width: share(Math.min(waitlist, Math.max(0, goal - members))),
          }}
        />
      </div>
    </div>
  );
}
