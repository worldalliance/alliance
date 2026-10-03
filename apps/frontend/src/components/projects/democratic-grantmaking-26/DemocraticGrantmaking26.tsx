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

const GRID =
  "grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_max(24rem,28.65%)] lg:gap-x-[5.65%]";

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
          className="bg-[var(--site-primary)] pb-10 text-white lg:flex lg:min-h-screen lg:flex-col lg:gap-[clamp(1.5rem,4vh,3.5rem)] lg:pb-[clamp(1.5rem,4vh,3.5rem)]"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className={cn(
              SITE_COL,
              GRID,
              "pt-10 lg:-translate-y-[2vh] lg:flex-1 lg:grid-cols-[minmax(0,1fr)_max(24rem,34%)] lg:items-center lg:gap-x-[3.5%] lg:pt-[clamp(1.5rem,5vh,4rem)]",
            )}
          >
            <div className="flex flex-col gap-4 lg:gap-[clamp(1rem,2.5vh,2rem)]">
              <DisplayHeading
                as="h1"
                onDark
                className="text-5xl sm:text-6xl lg:text-[clamp(3rem,min(5vw,8vh),6rem)]"
              >
                Help decide where to donate{" "}
                <span className="site-display text-green">$100,000</span>
              </DisplayHeading>
              <SiteSubtitle
                size={SubtitleSize.Page}
                onDark
                className="lg:hidden"
              >
                Join the Alliance to nominate a nonprofit and help decide where
                the money goes.
              </SiteSubtitle>
              <SiteSubtitle
                size={SubtitleSize.Page}
                onDark
                className="hidden lg:block"
              >
                Join the Alliance to choose which nonprofit gets it.
              </SiteSubtitle>
              <FeaturedPeople className="mt-4 hidden lg:flex" />
            </div>
            <WaitlistSignupForm className="w-full lg:gap-[clamp(0.75rem,1.5vh,1.25rem)]" />
          </div>
          <div className={cn(SITE_COL, "mt-14 lg:mt-0")}>
            <ProjectProgress />
          </div>
          <ProjectTimeline
            currentIdx={0}
            className={cn(SITE_COL, "mt-10 lg:mt-0")}
          />
          <section className={cn(SITE_COL, "mt-10 lg:hidden")}>
            <BandHeading onDark size={BandHeadingSize.Section} className="mb-6">
              Oversight
            </BandHeading>
            <FeaturedPeople />
          </section>
        </div>
        <div className={cn(SITE_COL, GRID, "pt-10 pb-16 lg:pt-14 lg:pb-24")}>
          <div className="flex flex-col gap-10">
            {ABOUT_SECTIONS.map((section) => (
              <section key={section.heading} className="flex flex-col gap-4">
                <BandHeading
                  size={BandHeadingSize.Section}
                  className="text-[var(--site-primary)]"
                >
                  {section.heading}
                </BandHeading>
                <DocProse markdown={section.body} />
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
