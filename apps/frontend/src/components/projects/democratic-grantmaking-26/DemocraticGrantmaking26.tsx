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
          className="min-h-svh bg-[var(--site-primary)] pb-10 text-white lg:flex lg:flex-col lg:pb-0"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className="flex flex-col pb-6 lg:contents"
            style={{ minHeight: `calc(100svh - ${NAV_HEIGHT}px)` }}
          >
            <div
              className={cn(
                PROJECT_COL,
                "grid grid-cols-1 gap-y-6 pt-10 lg:mt-[max(0px,calc((100svh_-_1000px)/3))] lg:grid-cols-[minmax(0,1fr)_max(24rem,34%)] lg:items-center lg:gap-x-[1.5%] lg:pt-[clamp(3rem,10vh,6rem)]",
              )}
            >
              <div className="flex flex-col gap-4 lg:gap-[clamp(1rem,2.5vh,2rem)]">
                <p className="site-sans text-left text-[1.05rem] text-white/80 sm:text-[1.2rem] lg:-mb-2">
                  Coming in fall 2026
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
                  Join the Alliance to nominate and vote on candidate
                  non-profits.
                </SiteSubtitle>
                <FeaturedPeople className="mt-4 hidden lg:flex" />
              </div>
              <WaitlistSignupForm className="w-full lg:translate-y-10 lg:gap-[clamp(0.75rem,1.5vh,1.25rem)]" />
            </div>
            <div
              className={cn(
                PROJECT_COL,
                "mt-auto pt-8 lg:mt-0 lg:flex lg:grow lg:flex-col lg:justify-end lg:pt-12",
              )}
            >
              <ProjectProgress />
            </div>
          </div>
          <div className={cn(PROJECT_COL, "mt-10 lg:mt-12 lg:grow lg:pb-34")}>
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
                className="flex flex-col items-start gap-5 md:items-center md:rounded-[var(--site-radius-card)] md:bg-zinc-100 md:p-10 lg:px-12"
              >
                <BandHeading
                  size={BandHeadingSize.Section}
                  className="text-[var(--site-primary)] md:text-center"
                >
                  {heading}
                </BandHeading>
                <DocProse
                  markdown={body}
                  className="w-full md:max-w-lg md:text-center [&_ol]:text-left"
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
