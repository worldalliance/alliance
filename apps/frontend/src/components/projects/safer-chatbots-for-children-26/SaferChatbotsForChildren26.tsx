import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { data } from "react-router";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { DocProse, DocProseSize } from "../../../site/DocProse";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import {
  BandHeading,
  BandHeadingSize,
  SiteRoot,
} from "../../../site/PageShell";
import { DisplayHeading, SITE_COL } from "../../../site/ui";
import { MEMBER_GOAL_LABEL } from "../democratic-grantmaking-26/GrantmakingMemberProgress";
import { MemberWaitlistBar } from "../democratic-grantmaking-26/MemberWaitlistBar";
import { useWaitlistCount } from "../democratic-grantmaking-26/useWaitlist";
import { WaitlistSignupForm } from "../democratic-grantmaking-26/WaitlistSignupForm";
import {
  ABOUT_SECTIONS,
  SHOW_TIMELINE,
  SIGNUP_BUTTON,
  SIGNUP_NOTE,
  WAITLIST_GOAL,
} from "./copy";
import { ExpertGrid } from "./ExpertGrid";
import { FactBlocks } from "./FactBlocks";
import { NewsCollage } from "./NewsCollage";
import { ProjectTimeline } from "./ProjectTimeline";

export function loader() {
  if (import.meta.env.MODE === "production") throw data(null, { status: 404 });
  return null;
}

export function meta() {
  return socialPreviewMeta({
    title: "Democratic Grantmaking '26 — The Alliance",
    description: `We're planning a project in which an expert panel and ${MEMBER_GOAL_LABEL} members will work together to make a significant grant.`,
    url: "/projects/safer-chatbots-for-children",
  });
}

const PROJECT_COL = cn(SITE_COL, "lg:max-w-[1400px]");

function ProjectProgress() {
  const members = useAllianceMemberCount();
  const waitlist = useWaitlistCount();
  if (members.data !== undefined && waitlist.data !== undefined) {
    return (
      <MemberWaitlistBar
        members={members.data}
        waitlist={waitlist.data}
        goal={WAITLIST_GOAL}
      />
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

export default function SaferChatbotsForChildren26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar />
      <main>
        <div
          className="bg-white lg:flex lg:min-h-svh lg:flex-col lg:pb-0"
          style={{ paddingTop: NAV_HEIGHT }}
        >
          <div
            className="flex flex-col justify-center max-lg:[@media(max-aspect-ratio:1/2)_and_(min-height:901px)]:min-h-0! lg:min-h-0! lg:flex-1"
            style={{ minHeight: `calc(100svh - ${NAV_HEIGHT}px)` }}
          >
            <div
              className={cn(
                PROJECT_COL,
                "grid grid-cols-1 gap-y-6 pt-16 [@media(max-width:480px)_and_(max-height:700px)]:pt-8 lg:grid-cols-[minmax(0,1fr)_max(24rem,34%)] lg:items-start lg:gap-x-[4%] lg:pt-[clamp(4rem,10svh,8rem)]",
              )}
            >
              <p className="-mb-2 text-left text-[1.05rem] text-[var(--site-ink)]/70 sm:text-[1.2rem]">
                Safer Chatbots for Children project / Winter 2026
              </p>
              <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:gap-[clamp(1rem,2.5vh,2rem)]">
                <DisplayHeading
                  as="h2"
                  leading={1.2}
                  className="text-4xl sm:text-5xl lg:text-[clamp(2.25rem,min(3.75vw,6vh),4.5rem)]"
                >
                  A generation is growing up with AI chatbots. It’s time the
                  public had a say.{" "}
                </DisplayHeading>
                {/* <SiteSubtitle size={SubtitleSize.Page}>
                  Once the Alliance reaches 1,000 members, we will nominate and
                  vote on non-profits together.
                </SiteSubtitle> */}
                <p className="text-left text-2xl sm:text-3xl">
                  Join our project with{" "}
                  <a
                    href="https://korabench.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    KORA,
                  </a>{" "}
                  a European research nonprofit, to improve tests measuring the
                  safety of chatbots for children worldwide.
                </p>
              </div>
              <WaitlistSignupForm
                className="w-full lg:col-start-2 lg:row-start-2 lg:self-center"
                submitLabel={SIGNUP_BUTTON}
                note={SIGNUP_NOTE}
              />
            </div>
            <div
              className={cn(
                PROJECT_COL,
                "pt-8 lg:pt-[clamp(1.5rem,4svh,4rem)]",
              )}
            >
              <ProjectProgress />
            </div>
            <div className={cn(PROJECT_COL, "pt-12 md:pt-16")}>
              <FactBlocks />
            </div>
            <div className={cn(PROJECT_COL, "pt-12 md:pt-16")}>
              <NewsCollage />
            </div>
            {SHOW_TIMELINE && (
              <div className={cn(PROJECT_COL, "pt-12 md:pt-16")}>
                <ProjectTimeline currentIdx={0} />
              </div>
            )}
          </div>
          <div
            className={cn(
              PROJECT_COL,
              "mt-12 flex flex-col gap-12 md:mt-16 md:gap-16",
            )}
          >
            <div className="flex flex-col items-center gap-8 rounded-lg bg-zinc-100 px-8 py-10 sm:px-12 sm:py-12">
              <p className="text-center text-lg text-[var(--site-ink)]/70 sm:text-xl">
                Safer Chatbots for Children is an ongoing project run by KORA, a
                leading AI safety evaluation nonprofit, and the Alliance, an
                online community of volunteers dedicated to tackling serious
                global issues. This project is advised by.
              </p>
              <ExpertGrid />
            </div>
          </div>
        </div>
        <div
          className={cn(PROJECT_COL, "pt-12 pb-20 md:pt-16 md:pb-24 lg:pb-32")}
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
