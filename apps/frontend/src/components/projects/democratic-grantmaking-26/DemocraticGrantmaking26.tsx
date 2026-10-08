import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { DocProse } from "../../../site/DocProse";
import { SiteFooter } from "../../../site/Footer";
import { WAITLIST_HREF } from "../../../site/links";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import {
  BandHeading,
  BandHeadingSize,
  SiteRoot,
} from "../../../site/PageShell";
import {
  DisplayHeading,
  SITE_COL,
  SiteSubtitle,
  SubtitleSize,
} from "../../../site/ui";
import { MEMBER_GOAL_LABEL } from "./GrantmakingMemberProgress";
import { MemberWaitlistBar } from "./MemberWaitlistBar";
import { PersonRow } from "./PersonRow";
import { ABOUT_SECTIONS, FEATURED_PEOPLE } from "./placeholders";
import { ProjectTimeline } from "./ProjectTimeline";
import { useWaitlistCount } from "./useWaitlist";
import { WaitlistSignupForm } from "./WaitlistSignupForm";

export function meta() {
  return socialPreviewMeta({
    title: "Democratic Grantmaking '26 — The Alliance",
    description: `We're planning a project in which an expert panel and ${MEMBER_GOAL_LABEL} members will work together to make a significant grant.`,
    url: WAITLIST_HREF,
  });
}

const PROJECT_COL = cn(SITE_COL, "lg:max-w-[1400px]");

function ProjectProgress() {
  const members = useAllianceMemberCount();
  const waitlist = useWaitlistCount();
  if (members.data !== undefined && waitlist.data !== undefined) {
    return (
      <MemberWaitlistBar members={members.data} waitlist={waitlist.data} />
    );
  }
  return (
    <p className="site-sans text-sm text-white/80">
      {members.isError || waitlist.isError
        ? "Member and waitlist counts unavailable"
        : "Loading member and waitlist counts…"}
    </p>
  );
}

function FeaturedPeople({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-8 gap-y-3", className)}>
      {FEATURED_PEOPLE.map((person) => (
        <li key={person.name} className="first:basis-full lg:first:basis-auto">
          <PersonRow person={person} />
        </li>
      ))}
    </ul>
  );
}

export default function DemocraticGrantmaking26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar overPrimary />
      <main>
        <div
          className="bg-[var(--site-primary)] pb-10 text-white lg:flex lg:min-h-svh lg:flex-col lg:pb-0"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className="flex flex-col justify-center pb-[clamp(1.5rem,10svh,6rem)] max-lg:[@media(max-aspect-ratio:1/2)_and_(min-height:901px)]:min-h-0! max-lg:[@media(max-aspect-ratio:1/2)_and_(min-height:901px)]:pb-6 md:pb-22 lg:min-h-0! lg:flex-1 lg:pb-0"
            style={{ minHeight: `calc(100svh - ${NAV_HEIGHT}px)` }}
          >
            <div
              className={cn(
                PROJECT_COL,
                "grid grid-cols-1 gap-y-6 pt-10 [@media(max-width:480px)_and_(max-height:700px)]:pt-6 lg:grid-cols-[minmax(0,1fr)_max(24rem,34%)] lg:items-center lg:gap-x-[1.5%] lg:pt-[clamp(1.5rem,4svh,4rem)]",
              )}
            >
              <div className="flex flex-col gap-4 lg:gap-[clamp(1rem,2.5vh,2rem)]">
                <p className="site-sans text-left text-[1.05rem] text-white/80 sm:text-[1.2rem] lg:-mb-2">
                  An Alliance project · Fall 2026
                </p>
                <DisplayHeading
                  as="h1"
                  onDark
                  leading={1.2}
                  className="text-5xl sm:text-6xl lg:text-[clamp(3rem,min(5vw,8vh),6rem)]"
                >
                  Help decide where to donate{" "}
                  <span className="site-display text-green">$100,000</span>
                </DisplayHeading>
                <SiteSubtitle size={SubtitleSize.Page} onDark>
                  Nominate and vote on non-profits.
                </SiteSubtitle>
                <FeaturedPeople className="mt-4 hidden lg:flex" />
              </div>
              <WaitlistSignupForm className="w-full lg:gap-[clamp(0.75rem,1.5vh,1.25rem)]" />
            </div>
            <div
              className={cn(
                PROJECT_COL,
                "pt-8 lg:pt-[clamp(1.5rem,4svh,4rem)]",
              )}
            >
              <ProjectProgress />
            </div>
          </div>
          <div
            className={cn(
              PROJECT_COL,
              "mt-10 lg:mt-[clamp(1.5rem,4svh,3rem)] lg:pb-[clamp(1.5rem,6svh,6rem)]",
            )}
          >
            <ProjectTimeline currentIdx={0} />
          </div>
          <section className={cn(PROJECT_COL, "mt-10 lg:hidden")}>
            <BandHeading
              onDark
              size={BandHeadingSize.Section}
              className="mb-6 text-center"
            >
              Experts
            </BandHeading>
            <FeaturedPeople />
          </section>
        </div>
        <div className={cn(PROJECT_COL, "py-6 md:py-[1.05rem] lg:py-12")}>
          <div className="grid gap-10 md:grid-cols-2 md:gap-4">
            {ABOUT_SECTIONS.map(({ heading, body }) => (
              <section
                key={heading}
                className="flex flex-col items-start gap-5 md:rounded-[var(--site-radius-card)] md:bg-zinc-100 md:p-10 lg:px-12"
              >
                <BandHeading
                  size={BandHeadingSize.Section}
                  className="text-[var(--site-primary)]"
                >
                  {heading}
                </BandHeading>
                <DocProse
                  markdown={body}
                  className="w-full md:max-w-lg text-left"
                />
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
