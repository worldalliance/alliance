import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { DocProse } from "../../../site/DocProse";
import { SiteFooter } from "../../../site/Footer";
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
import { ABOUT_SECTIONS, FEATURED_PEOPLE, MEMBERS } from "./placeholders";
import { ProjectTimeline } from "./ProjectTimeline";
import { useWaitlistCount } from "./useWaitlist";
import { WaitlistSignupForm } from "./WaitlistSignupForm";

export function meta() {
  return socialPreviewMeta({
    title: "Democratic Grantmaking '26 — The Alliance",
    description: `We're planning a project in which an expert panel and ${MEMBER_GOAL_LABEL} members will work together to make a significant grant.`,
    url: "/projects/democratic-grantmaking-26",
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
    <p className="site-sans text-sm text-zinc-500">
      {members.isError || waitlist.isError
        ? "Member and waitlist counts unavailable"
        : "Loading member and waitlist counts…"}
    </p>
  );
}

export default function DemocraticGrantmaking26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar overPrimary />
      <main>
        <div
          className="bg-[var(--site-primary)] pb-10 text-white lg:pb-16"
          style={{ paddingTop: NAV_HEIGHT + 64 }}
        >
          <div className={cn(SITE_COL, GRID)}>
            <div className="flex flex-col gap-4">
              <DisplayHeading
                as="h1"
                onDark
                className="text-5xl sm:text-6xl lg:text-7xl"
              >
                Help decide where to donate{" "}
                <span className="site-display text-green">$100,000</span>
              </DisplayHeading>
              <SiteSubtitle
                size={SubtitleSize.Page}
                onDark
                className="lg:hidden"
              >
                Join the Alliance to propose nonprofits and participate in a
                first-of-its-kind democratic philanthropy experiment.
              </SiteSubtitle>
              <SiteSubtitle
                size={SubtitleSize.Page}
                onDark
                className="hidden lg:block"
              >
                Join the Alliance to participate in a groundbreaking
                philanthropic experiment
              </SiteSubtitle>
              <ul className="mt-4 hidden flex-wrap gap-x-8 gap-y-3 lg:flex">
                {FEATURED_PEOPLE.map((person) => (
                  <li key={person.name}>
                    <PersonRow person={person} onDark />
                  </li>
                ))}
              </ul>
            </div>
            <WaitlistSignupForm className="w-full max-w-lg lg:max-w-none" />
          </div>
          <ProjectTimeline
            currentIdx={0}
            className={cn(SITE_COL, "mt-14 lg:mt-28")}
          />
        </div>
        <div className={cn(SITE_COL, GRID, "pt-10 pb-16 lg:pt-14 lg:pb-24")}>
          <div className="flex flex-col gap-10">
            <ProjectProgress />
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
          <aside className="hidden flex-col gap-4 lg:flex">
            <BandHeading
              size={BandHeadingSize.Section}
              className="text-[var(--site-primary)]"
            >
              Members
            </BandHeading>
            <ul className="flex flex-col gap-3">
              {MEMBERS.map((person) => (
                <li key={person.name}>
                  <PersonRow person={person} />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
