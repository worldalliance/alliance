import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";
import { Calendar, Clock } from "lucide-react";
import grassField from "../assets/redesign/grass-field.jpg";

const INFO_SESSION_HREF =
  "https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MmUxZ3FxMmhtcWExbHQ3ODU4dHE5YjF2ODggZ3JhbnRAd29ybGRhbGxpYW5jZS5vcmc&tmsrc=grant%40worldalliance.org";

const INFO_SESSION_STARTS_AT = new Date("2026-09-14T09:00:00-07:00");

const INFO_SESSION_WHEN = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
}).format(INFO_SESSION_STARTS_AT);

const TASK_TITLE = "Choose between recipients of our $100,000 grant";

const TASK_MINUTES = 15;

const TASK_JOINED = 211;

const TASK_REQUIRED = 1000;

export function InfoSessionButton() {
  return (
    <Button
      color={ButtonColor.White}
      className="h-auto w-full justify-start gap-3 py-3 whitespace-normal"
      onClick={() => window.open(INFO_SESSION_HREF, "_blank", "noreferrer")}
    >
      <Calendar className="size-4 shrink-0" aria-hidden />
      <span className="flex flex-col items-start gap-0.5 text-left leading-snug">
        <span>Come to our next info session</span>
        <span className="font-normal text-[var(--site-ink)]/55">
          {INFO_SESSION_WHEN}
        </span>
      </span>
    </Button>
  );
}

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
      <div className="mt-4">
        <p className="mb-1.5 text-sm text-zinc-600">
          {TASK_JOINED.toLocaleString("en-US")} /{" "}
          {TASK_REQUIRED.toLocaleString("en-US")} members required
        </p>
        <CompletedBar percentage={(TASK_JOINED / TASK_REQUIRED) * 100} />
      </div>
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
      </div>
    </div>
  );
}
