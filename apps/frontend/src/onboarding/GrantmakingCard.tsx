import { Calendar } from "lucide-react";
import { href, Link } from "react-router";
import { DisplayHeading, SiteArrow, SiteButton } from "../site/ui";

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

export function InfoSessionButton() {
  return (
    <SiteButton
      href={INFO_SESSION_HREF}
      tone="outline"
      size="sm"
      lift={false}
      className="h-auto max-w-full items-center self-start py-2.5 whitespace-normal hover:border-[var(--site-link)]/40 hover:bg-[var(--site-link)]/10"
    >
      <Calendar className="size-4 shrink-0" aria-hidden />
      <span className="flex flex-col items-start gap-0.5 text-left leading-snug">
        <span>Come to our next info session for new members</span>
        <span className="font-normal text-[var(--site-ink)]/55">
          {INFO_SESSION_WHEN}
        </span>
      </span>
    </SiteButton>
  );
}

export function GrantmakingCard({ className }: { className?: string }) {
  return (
    <Link
      to={href("/projects/democratic-grantmaking-26")}
      className={`group flex flex-col justify-end bg-[var(--site-primary)] p-7 text-left text-white transition-colors hover:bg-[var(--site-primary-hover)] sm:p-9 ${className ?? ""}`}
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <p className="text-base text-white/40 md:text-lg">
        Upcoming project in fall 2026
      </p>
      <DisplayHeading
        as="h2"
        className="mt-4 text-4xl text-balance text-white sm:text-5xl lg:text-6xl"
      >
        Where should we donate <span className="text-green">$100,000</span>?
      </DisplayHeading>
      <p className="mt-6 text-lg leading-snug text-white/90 sm:text-xl">
        As a member, you will be able to help us direct a significant grant.
      </p>
      <span className="mt-10 flex items-end justify-between gap-4">
        <span className="text-lg text-white/80 sm:text-xl">
          <span className="font-semibold text-green">$35,300</span> committed so
          far
        </span>
        <SiteArrow className="mb-1 size-5 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1" />
      </span>
    </Link>
  );
}
