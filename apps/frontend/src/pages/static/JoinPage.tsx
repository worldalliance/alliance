import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { JoinRequestForm } from "../../site/JoinRequestForm";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Request to join the Alliance",
    description:
      "Membership is by invitation only while we are still experimental. Please share a little about yourself and we will follow up shortly.",
    url: "/join",
  });
}

const JOIN_TITLE = "Request to join";
const JOIN_LEDE =
  "Membership is by invitation only while we are still experimental. Please share a little about yourself and we will follow up shortly.";

/** The three points beside the form, so the page is not a bare form. */
const JOIN_EXPECTATIONS = [
  "There is a 15-minute weekly commitment.",
  "Tasks arrive through our web and mobile apps.",
  "You can withdraw from any task if it takes too long.",
];

export default function JoinPage() {
  return (
    <PageShell title={JOIN_TITLE} subtitle={JOIN_LEDE} showJoinCta={false}>
      <div
        className={cn(
          SITE_COL,
          "grid gap-12 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20 lg:pt-20 lg:pb-28",
        )}
      >
        <ul className="flex flex-col gap-5">
          {JOIN_EXPECTATIONS.map((expectation) => (
            <li key={expectation} className="flex gap-3.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary)] text-white">
                <Check className="size-3.5" aria-hidden />
              </span>
              <span className="text-[1.08rem] leading-snug text-[var(--site-ink)]/80">
                {expectation}
              </span>
            </li>
          ))}
        </ul>
        <div
          className="bg-zinc-100 p-7 sm:p-9"
          style={{ borderRadius: "var(--site-radius-card)" }}
        >
          <JoinRequestForm />
        </div>
      </div>
    </PageShell>
  );
}
