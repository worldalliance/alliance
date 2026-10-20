import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { DocProse, DocProseSize } from "../../../site/DocProse";
import { SiteFooter } from "../../../site/Footer";
import { WAITLIST_HREF } from "../../../site/links";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import {
  BandHeading,
  BandHeadingSize,
  SiteRoot,
} from "../../../site/PageShell";
import { DisplayHeading, SITE_COL } from "../../../site/ui";
import { ExpertGrid } from "./ExpertGrid";
import { MEMBER_GOAL_LABEL } from "./GrantmakingMemberProgress";
import { MemberWaitlistBar } from "./MemberWaitlistBar";
import { ABOUT_SECTIONS } from "./placeholders";
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
    <p className="site-sans text-base text-[var(--site-ink)]/70">
      {members.isError || waitlist.isError
        ? "Member and waitlist counts unavailable"
        : "Loading member and waitlist counts…"}
    </p>
  );
}

export default function DemocraticGrantmaking26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar />
      <main>
        <div
          className="bg-white pb-10 lg:flex lg:min-h-svh lg:flex-col lg:pb-0"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className="flex flex-col justify-center pb-[clamp(1.5rem,10svh,6rem)] max-lg:[@media(max-aspect-ratio:1/2)_and_(min-height:901px)]:min-h-0! max-lg:[@media(max-aspect-ratio:1/2)_and_(min-height:901px)]:pb-6 md:pb-22 lg:min-h-0! lg:flex-1 lg:pb-0"
            style={{ minHeight: `calc(100svh - ${NAV_HEIGHT}px)` }}
          >
            <div
              className={cn(
                PROJECT_COL,
                "grid grid-cols-1 gap-y-6 pt-16 [@media(max-width:480px)_and_(max-height:700px)]:pt-8 lg:grid-cols-[minmax(0,1fr)_max(24rem,34%)] lg:items-center lg:gap-x-[10%] lg:pt-[clamp(4rem,10svh,8rem)]",
              )}
            >
              <div className="flex flex-col gap-4 lg:gap-[clamp(1rem,2.5vh,2rem)]">
                <p className="text-left text-[1.05rem] text-[var(--site-ink)]/70 sm:text-[1.2rem] lg:-mb-2">
                  An Alliance project / Fall 2026
                </p>
                <DisplayHeading
                  as="h1"
                  leading={1.1}
                  className="text-5xl sm:text-6xl lg:text-8xl"
                >
                  Decide where to donate{" "}
                  <span className="site-display">$100,000</span>
                </DisplayHeading>
                <p className="text-left text-2xl sm:text-3xl">
                  We&apos;re an online group that completes 15-minute weekly
                  projects to improve the world. When we reach 1,000 members,
                  outside funders will give $100,000 to a nonprofit we choose
                  together.
                </p>
              </div>
              <WaitlistSignupForm className="w-full" />
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
          <div className={cn(PROJECT_COL, "mt-12 lg:mt-24 lg:pb-24")}>
            <div className="flex flex-col items-center gap-8 rounded-lg bg-zinc-100 px-8 py-10 sm:px-20 sm:py-14">
              <div className="flex flex-col items-center gap-1">
                <p className="text-center text-xl sm:text-2xl font-medium">
                  A model for public-expert collaboration
                </p>
                <p className="text-center text-lg text-[var(--site-ink)]/70 sm:text-xl">
                  Experts will comment on candidate nonprofits to help you make
                  an informed vote.
                </p>
              </div>
              <div className="mx-auto sm:max-w-3/4">
                <ExpertGrid />
              </div>
            </div>
            <ProjectTimeline currentIdx={0} className="mt-14 lg:mt-20" />
          </div>
        </div>
        <div
          className={cn(
            PROJECT_COL,
            "pt-6 pb-20 md:pt-[1.05rem] md:pb-24 lg:pt-12 lg:pb-32",
          )}
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-12 md:gap-16">
            {ABOUT_SECTIONS.map(({ heading, body }) => (
              <section
                key={heading}
                className="flex flex-col items-start gap-5 text-left"
              >
                <BandHeading
                  size={BandHeadingSize.Section}
                  className="text-left"
                >
                  {heading}
                </BandHeading>
                <DocProse
                  size={DocProseSize.Large}
                  markdown={body}
                  className="w-full text-left"
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
