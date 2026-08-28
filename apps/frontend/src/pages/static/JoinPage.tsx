import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { JoinRequestForm } from "../../site/JoinRequestForm";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Request to join — The Alliance",
    description:
      "Membership is by invitation while we are still small. Tell us a little about yourself and we will follow up.",
    url: "/join",
  });
}

const JOIN_TITLE = "Request to join";
const JOIN_LEDE =
  "Membership is by invitation while we are still small. Tell us a little about yourself and we will follow up with a signup link if there is a fit.";

/** The three points beside the form, so the page is not a bare form. */
const JOIN_EXPECTATIONS = [
  "15 minutes a week, in one block, with a 7-day window to finish it.",
  "Tasks arrive through our platform, already researched and scoped by the office.",
  "You can withdraw from any task you object to, and leave whenever you like.",
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
          className="bg-[var(--site-surface-alt)] p-7 sm:p-9"
          style={{ borderRadius: "var(--site-radius-card)" }}
        >
          <JoinRequestForm />
        </div>
      </div>
    </PageShell>
  );
}
