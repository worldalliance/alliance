import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { data } from "react-router";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { DisplayHeading, SITE_COL } from "../../../site/ui";
import { WaitlistSignupForm } from "../democratic-grantmaking-26/WaitlistSignupForm";
import { AboutGrid } from "./AboutGrid";
import {
  EXPERTS_HEADING,
  EXPERTS_SUBTITLE,
  PARTICIPANT_GOAL,
  SHOW_FACTS,
  SHOW_TIMELINE,
  SIGNUP_BUTTON,
  SIGNUP_CLOSED,
  SIGNUP_NOTE,
} from "./copy";
import { ExpertGrid } from "./ExpertGrid";
import { FactBlocks } from "./FactBlocks";
import { NewsCollage } from "./NewsCollage";
import { ParticipantsBar } from "./ParticipantsBar";
import { ProjectTimeline } from "./ProjectTimeline";

export function loader() {
  if (import.meta.env.MODE === "production") throw data(null, { status: 404 });
  return null;
}

export function meta() {
  return socialPreviewMeta({
    title: "Safer Chatbots for Children — The Alliance",
    description:
      "Join our volunteer project with KORA, a European research nonprofit, to improve tests measuring the safety of chatbots for children worldwide.",
    url: "/projects/safer-chatbots-for-children",
  });
}

const PROJECT_COL = cn(SITE_COL, "lg:max-w-[1400px]");

function ProjectProgress() {
  const members = useAllianceMemberCount();
  if (members.data !== undefined) {
    return (
      <ParticipantsBar participants={members.data} goal={PARTICIPANT_GOAL} />
    );
  }
  return (
    <p className="site-sans text-base text-[var(--site-ink)]/70">
      {members.isError
        ? "Participant count unavailable"
        : "Loading participant count…"}
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
                Safer Chatbots for Children / Winter 2026
              </p>
              <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:gap-[clamp(1rem,2.5vh,2rem)]">
                <DisplayHeading
                  as="h2"
                  leading={1.2}
                  className="text-4xl sm:text-5xl lg:text-[clamp(2.25rem,min(3.75vw,6vh),4.5rem)]"
                >
                  A generation of kids is growing up with AI chatbots. Help make
                  sure they are safe.{" "}
                </DisplayHeading>
                <p className="text-left text-2xl sm:text-3xl">
                  Join our volunteer project with{" "}
                  <a
                    href="https://korabench.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    KORA,
                  </a>{" "}
                  a safety research nonprofit, to improve the safety of chatbots
                  for children worldwide.
                </p>
              </div>
              <WaitlistSignupForm
                className="w-full lg:col-start-2 lg:row-start-2 lg:self-center"
                submitLabel={SIGNUP_BUTTON}
                note={SIGNUP_NOTE}
                closedMessage={SIGNUP_CLOSED}
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
              <AboutGrid />
            </div>
            {SHOW_TIMELINE && (
              <div className={cn(PROJECT_COL, "pt-12 md:pt-16")}>
                <ProjectTimeline currentIdx={0} />
              </div>
            )}
            {SHOW_FACTS && (
              <div className={cn(PROJECT_COL, "pt-12 md:pt-16")}>
                <FactBlocks />
              </div>
            )}
          </div>
          <div
            className={cn(
              PROJECT_COL,
              "mt-12 flex flex-col gap-12 pb-20 md:mt-16 md:gap-16 md:pb-24 lg:pb-32",
            )}
          >
            <div className="flex flex-col items-center gap-8 rounded-lg bg-zinc-100 px-7 py-8 sm:px-14 sm:py-10">
              <div className="flex flex-col items-center gap-1">
                <p className="text-center text-xl font-medium sm:text-2xl">
                  {EXPERTS_HEADING}
                </p>
                <p className="text-center text-lg text-[var(--site-ink)]/70 sm:text-xl">
                  {EXPERTS_SUBTITLE}
                </p>
              </div>
              <ExpertGrid />
            </div>
            <NewsCollage />
          </div>
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
