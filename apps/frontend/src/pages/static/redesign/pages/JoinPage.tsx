import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { RedesignPage } from "../links";
import {
  JOIN_EXPECTATIONS,
  JOIN_LEDE,
  JOIN_TITLE,
} from "../pageContent";
import { cardsByKind } from "../sections/HowItWorks";
import { RequestToJoinForm } from "../sections/JoinRequest";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { RD_COL } from "../ui";

/**
 * Versions 5 to 7 (and 1 to 3) send every join button here. Version 4 opens the
 * same form in a modal instead, so it never lands on this page.
 */
export function RedesignJoinPage({ theme }: { theme: RedesignTheme }) {
  const Cards = cardsByKind[theme.productCards];

  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Join}
      title={JOIN_TITLE}
      lede={JOIN_LEDE}
      showJoinCta={false}
    >
      <div
        className={cn(
          RD_COL,
          "grid gap-12 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20 lg:pt-20 lg:pb-28",
        )}
      >
<div className="flex flex-col gap-10">
          <ul className="flex flex-col gap-5">
            {JOIN_EXPECTATIONS.map((expectation) => (
              <li key={expectation} className="flex gap-3.5">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-[var(--rd-accent)] text-white"
                  style={{ borderRadius: "9999px" }}
                >
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-[1.08rem] leading-snug text-[var(--rd-ink)]/80">
                  {expectation}
                </span>
              </li>
            ))}
          </ul>
          {/* The three product screens from "how does it work", stacked. */}
          <div className="grid gap-4">
            <Cards />
          </div>
        </div>
        <div
          className="bg-[var(--rd-surface-alt)] p-7 sm:p-9"
          style={{ borderRadius: "var(--rd-radius-card)" }}
        >
          <RequestToJoinForm />
        </div>
      </div>
    </PageShell>
  );
}
