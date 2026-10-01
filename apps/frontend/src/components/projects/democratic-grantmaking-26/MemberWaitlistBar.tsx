import { cn } from "@alliance/shared/styles/util";
import { MEMBER_GOAL } from "./GrantmakingMemberProgress";

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
      <p className="flex items-center gap-2.5 text-sm text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="bg-green size-3 rounded-[2px]" aria-hidden />
          {members.toLocaleString("en-US")} Members
        </span>
        <span className="flex items-center gap-1">
          <span
            className="size-3 rounded-[2px] bg-[var(--site-primary)]"
            aria-hidden
          />
          {waitlist.toLocaleString("en-US")} Waitlist
        </span>
      </p>
      <div
        role="img"
        aria-label={`${members} members and ${waitlist} on the waitlist, toward ${MEMBER_GOAL.toLocaleString("en-US")}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100"
      >
        <div
          className="bg-green h-full rounded-l-full"
          style={{ width: share(members) }}
        />
        <div
          className="h-full rounded-r-full bg-[var(--site-primary)]"
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
