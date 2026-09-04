import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { CONTACT_EMAIL } from "../../../site/content";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { DisplayHeading, SITE_COL, SiteArrow } from "../../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Democratic Grantmaking '26 — The Alliance",
    description:
      "We're planning a project in which an expert panel and 1,000 members will work together to make a significant grant.",
    url: "/projects/democratic-grantmaking-26",
  });
}

const MEMBER_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("I'd like to become a member")}`;

export default function DemocraticGrantmaking26() {
  return (
    <SiteRoot className="bg-[var(--site-primary)] text-white">
      <Navbar overPrimary />
      <main className="flex h-dvh flex-col" style={{ paddingTop: NAV_HEIGHT }}>
        <div
          className={cn(
            SITE_COL,
            "flex flex-1 flex-col justify-end pb-24 lg:pb-24",
          )}
        >
          <div className="flex flex-col gap-6 md:gap-12 lg:flex-row lg:items-end xl:gap-64">
            <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-6 text-left">
              <p className="text-base text-white/40 md:text-lg">
                Coming in fall 2026
              </p>
              <DisplayHeading
                as="h1"
                className="w-full text-balance text-5xl text-white sm:text-7xl lg:text-8xl xl:text-[8rem]"
              >
                Decide how to donate{" "}
                <span className="text-green">$100,000</span>
              </DisplayHeading>
              <div className="flex w-full flex-col items-start gap-4">
                <p className="text-lg leading-snug text-white sm:text-4xl lg:text-5xl">
                  We&apos;re planning a project in which an expert panel and
                  1,000 members will work together to make a significant grant.
                </p>
                <p className="text-xl text-white/80 md:text-2xl">
                  <span className="font-semibold text-green">$11,200</span>{" "}
                  committed by funders so far
                </p>
              </div>
            </div>
            <a
              href={MEMBER_MAILTO}
              className="flex min-h-52 w-full shrink-0 flex-col justify-end bg-white p-6 text-left text-[var(--site-ink)] hover:bg-zinc-200 sm:min-h-64 sm:max-w-sm sm:p-8 lg:min-h-72 lg:w-[22rem] lg:max-w-none"
              style={{ borderRadius: "var(--site-radius-card)" }}
            >
              <span className="flex w-full items-end justify-between gap-4">
                <span className="max-w-[10ch] text-[1.7rem] leading-tight font-medium sm:text-[2.1rem] lg:text-[2.4rem]">
                  Become a member to participate
                </span>
                <SiteArrow className="mb-1 size-5 shrink-0" />
              </span>
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
