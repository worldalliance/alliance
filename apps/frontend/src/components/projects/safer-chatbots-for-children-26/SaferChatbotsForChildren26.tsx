import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { cn } from "@alliance/shared/styles/util";
import { data } from "react-router";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { WaitlistHeroImages } from "../democratic-grantmaking-26/DemocraticGrantmaking26";
import { WaitlistSignupForm } from "../democratic-grantmaking-26/WaitlistSignupForm";
import { AboutSections } from "./AboutSections";
import {
  HERO_IMAGES,
  PARTICIPANT_GOAL,
  SHOW_FACTS,
  SHOW_TIMELINE,
  SIGNUP_BUTTON,
  SIGNUP_CLOSED,
  SIGNUP_NOTE,
} from "./copy";
import { ExpertList } from "./ExpertList";
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

function HeroScreen() {
  return (
    <section
      aria-label="Sign up"
      className="flex min-h-svh flex-col bg-white"
      style={{ paddingTop: NAV_HEIGHT }}
    >
      <div
        className={cn(
          PROJECT_COL,
          "my-auto grid grid-cols-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-24 lg:py-12 xl:gap-x-32",
        )}
      >
        <div className="flex flex-col gap-4 lg:gap-5">
          <p className="-mb-2 text-left text-[1.05rem] text-[var(--site-ink)]/70 sm:text-[1.2rem]">
            Winter 2026
          </p>
          <h1 className="site-display font-medium text-5xl sm:text-6xl lg:text-7xl">
            Make AI chatbots{" "}
            <span className="site-display font-semibold text-green">
              safer for kids
            </span>
          </h1>
          <p className="text-left text-xl sm:text-2xl">
            80% of children use AI chatbots in 2026. Join our project with{" "}
            <a
              href="https://korabench.ai"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              KORA,
            </a>{" "}
            a safety research nonprofit, to improve the safety of chatbots for
            children worldwide.
          </p>
          <ExpertList />
          <WaitlistSignupForm
            className="mt-2 w-full"
            submitLabel={SIGNUP_BUTTON}
            note={SIGNUP_NOTE}
            closedMessage={SIGNUP_CLOSED}
          />
        </div>
        <div className="flex justify-center lg:justify-end">
          <WaitlistHeroImages images={HERO_IMAGES} />
        </div>
      </div>
    </section>
  );
}

export default function SaferChatbotsForChildren26() {
  return (
    <SiteRoot className="bg-white">
      <Navbar />
      <main>
        <HeroScreen />
        <div
          className={cn(
            PROJECT_COL,
            "flex flex-col gap-12 pb-20 md:gap-16 md:pb-24 lg:pb-32",
          )}
        >
          <ProjectProgress />
          {SHOW_TIMELINE && <ProjectTimeline currentIdx={0} />}
          <AboutSections />
          {SHOW_FACTS && <FactBlocks />}
          <NewsCollage />
        </div>
      </main>
      <SiteFooter />
    </SiteRoot>
  );
}
