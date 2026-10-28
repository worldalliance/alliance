import { cn } from "@alliance/shared/styles/util";
import { ProgressTrack, ProgressTrackSize } from "../../../site/ProgressTrack";

export function ParticipantsBar({
  participants,
  goal,
  className,
}: {
  participants: number;
  goal: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "site-sans flex flex-col-reverse gap-2 lg:flex-col",
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg text-[var(--site-ink)]/70 sm:text-xl">
        <span className="flex items-center gap-1">
          <span className="bg-green size-4 rounded-sm" aria-hidden />
          {participants.toLocaleString("en-US")} participants
        </span>
        <span className="ml-auto">
          Goal: {goal.toLocaleString("en-US")} participants
        </span>
      </p>
      <ProgressTrack
        goal={goal}
        segments={[{ count: participants, className: "bg-green" }]}
        size={ProgressTrackSize.Page}
        label={`${participants} participants, toward ${goal.toLocaleString("en-US")}`}
      />
    </div>
  );
}
