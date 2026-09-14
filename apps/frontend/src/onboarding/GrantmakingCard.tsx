import { cn } from "@alliance/shared/styles/util";
import { Clock } from "lucide-react";
import grassField from "../assets/redesign/grass-field.jpg";
import { GrantmakingMemberProgress } from "../components/projects/democratic-grantmaking-26/GrantmakingMemberProgress";

const TASK_TITLE = "Choose between recipients of our $100,000 grant";

const TASK_MINUTES = 15;

/** A task from the grantmaking project, drawn the way the real task list draws one. */
function GrantTaskMock() {
  return (
    <div className="w-full max-w-[31.2rem] rounded-xl bg-white p-5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.55)]">
      <p className="text-[1.0625rem] leading-snug font-semibold text-balance text-black">
        {TASK_TITLE}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-green)]">
        <Clock className="size-3.5" aria-hidden />
        {TASK_MINUTES} minutes
      </p>
    </div>
  );
}

export function GrantmakingCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col justify-between overflow-hidden p-7 text-left sm:p-9",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <img
        src={grassField}
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      {/* The type sits straight on the photo, so it needs its own floor of contrast. */}
      <div
        className="absolute inset-0 -z-10 bg-[var(--site-primary)]/58"
        aria-hidden
      />

      <div className="flex flex-1 items-center justify-center py-6">
        <GrantTaskMock />
      </div>

      <div>
        <p className="text-base text-white/70 md:text-lg">
          Upcoming project, fall 2026
        </p>
        {/* The standfirst voice the left column used to carry, moved onto the card. */}
        <p className="mt-2 max-w-[33rem] leading-[1.35] text-white text-xl sm:text-2xl">
          Where should we donate $100,000?
        </p>
        <GrantmakingMemberProgress className="mt-4 max-w-sm text-sm" />
      </div>
    </div>
  );
}
