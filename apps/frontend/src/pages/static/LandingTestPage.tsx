import { cn } from "@alliance/shared/styles/util";
import { ArrowRightIcon } from "lucide-react";
import React from "react";
import { Link } from "react-router";

import alliancePeople1280 from "../../assets/alliance_people-1280.webp";
import alliancePeople640 from "../../assets/alliance_people-640.webp";
import alliancePeople960 from "../../assets/alliance_people-960.webp";
import alliancePeople from "../../assets/alliance_people.webp";
import Footer from "../../components/Footer";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { LANDING_PAGE_STACK } from "./prelaunchLayout";

export function meta() {
  return socialPreviewMeta({
    title: "The Alliance — Landing test",
    description: "A global community working together to improve the world.",
    image: "/og-home.png",
    url: "/landing-test",
  });
}

const CONTENT_COL = "mx-auto w-full max-w-7xl px-4 sm:px-10 lg:px-16";
/** Near full-viewport width for images / example grids. */
const MEDIA_COL = "mx-auto w-full max-w-[100rem] px-3 sm:px-4 lg:px-6";

const SECTION_PY = "py-14 md:py-20 lg:py-24";
const SECTION_STACK = "flex flex-col gap-8 lg:gap-10";

const TITLE_CLASS =
  "font-sans text-3xl font-semibold text-zinc-900 sm:text-4xl lg:text-5xl w-full";
const SUBTITLE_CLASS =
  "font-serif text-xl text-zinc-900 sm:text-2xl lg:text-3xl max-w-5xl leading-snug";
const TITLE_SUBTITLE_GAP = "flex flex-col gap-3 lg:gap-4";

function PlaceholderImage({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-md bg-zinc-100 text-zinc-400",
        "aspect-[16/9] text-sm sm:text-base",
        className,
      )}
      aria-hidden
    >
      {label}
    </div>
  );
}

const EXAMPLE_PROJECTS = [
  {
    title: "Running a large-scale plant-based diet study",
    description:
      "We ran a 2-week study with 274 participants to understand what is easy and difficult about adopting a plant-based diet.",
  },
  {
    title: "Creating a bring-your-own-cup coalition",
    description:
      "We asked 11 cafe locations to adopt bring-your-own-cup policies, and in return we helped them attain media recognition.",
    imgSrc: "https://worldalliance.org/api/images/1759964091349.webp",
  },
  {
    title: "Adjusting personal habits for collective donation",
    description:
      "We raised $2,702 for Helen Keller International by avoiding small amounts of personal spending for a week.",
    imgSrc: "https://dj92mxbdjuclo.cloudfront.net/1785969542083.webp",
  },
] as const;

const COMMITMENT_POINTS = [
  "Agreement to participate in 15 minutes/week of action",
  "Can withdraw from actions",
  "Members guide us via feedback and formal oversight",
] as const;

const BIG_PROBLEM_POINTS = [
  "Generally, expert consensus on the major problems and their solutions",
  "Coordination problems — where working together consistently is key",
  "Problems controlled by our collective action or inaction",
] as const;

const SCALE_EXAMPLES = [
  "Lifestyle changes at population scale",
  "Corporate accountability campaigns",
  "Coordinated policy and standards input",
] as const;

const LandingTestPage: React.FC = () => {
  useWhiteBackground();

  return (
    <div className="flex flex-col bg-white">
      <div className={LANDING_PAGE_STACK}>
        <PrelaunchNavbar transparent={false} absolute={false} />
        <section className="relative w-full bg-white pb-14 md:pb-20 lg:pb-24">
          <div className={cn(SECTION_STACK, "pt-10 sm:pt-14 lg:pt-20")}>
            <div className={cn(CONTENT_COL, "flex flex-col gap-8")}>
              <div className={TITLE_SUBTITLE_GAP}>
                <h1 className="font-sans text-4xl font-semibold text-zinc-900 sm:text-5xl lg:text-6xl max-w-5xl leading-17">
                  We&apos;re a global community working together to improve the
                  world.
                </h1>
                <p className={SUBTITLE_CLASS}>
                  We are learning how to coordinate global action over the
                  Internet. Members participate in weekly projects designed for
                  tangible impact.
                </p>
              </div>
              <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  to="#join"
                  className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2.5 text-base font-medium text-white hover:bg-zinc-800 sm:text-lg"
                >
                  Join us
                  <ArrowRightIcon className="size-4 sm:size-5" aria-hidden />
                </Link>
                {/* <Link
                  to="#join"
                  className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 sm:text-lg"
                >
                  Project waitlist
                </Link> */}
              </div>
            </div>
            <div className={MEDIA_COL}>
              <figure>
                <img
                  src={alliancePeople}
                  srcSet={`${alliancePeople640} 640w, ${alliancePeople960} 960w, ${alliancePeople1280} 1280w, ${alliancePeople} 2000w`}
                  sizes="(min-width: 1024px) 100rem, (min-width: 768px) 100vw, 100vw"
                  alt="Alliance members at a meetup"
                  width={2000}
                  height={1333}
                  loading="eager"
                  decoding="async"
                  className="w-full h-auto rounded-md"
                />
                <figcaption className="mt-3 text-center text-lg text-zinc-500">
                  Members at a meetup in San Francisco, California
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-white", SECTION_PY)}>
          <div className={SECTION_STACK}>
            <div className={cn(CONTENT_COL, TITLE_SUBTITLE_GAP)}>
              <h2 className={TITLE_CLASS}>
                We strive to run projects that are worth your time
              </h2>
              <p className={SUBTITLE_CLASS}>
                We plan high-quality, expert-informed projects that are likely
                to produce measurable impact.
              </p>
            </div>
            <div
              className={cn(
                MEDIA_COL,
                "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6",
              )}
            >
              {EXAMPLE_PROJECTS.map((project) => (
                <div key={project.title} className="flex flex-col gap-6">
                  {project.imgSrc ? (
                    <img
                      src={project.imgSrc}
                      alt={project.title}
                      className="aspect-[4/3] object-cover"
                    />
                  ) : (
                    <PlaceholderImage
                      label={project.title}
                      className="aspect-[4/3]"
                    />
                  )}
                  <div className="flex flex-col gap-1">
                    <p className="font-sans text-xl font-semibold text-zinc-900">
                      {project.title}
                    </p>
                    <p className="text-base text-zinc-600 lg:text-lg">
                      {project.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-white", SECTION_PY)}>
          <div className={SECTION_STACK}>
            <div className={cn(CONTENT_COL, "flex flex-col gap-8")}>
              <div className={TITLE_SUBTITLE_GAP}>
                <h2 className={TITLE_CLASS}>
                  To plan projects, we need commitment
                </h2>
                <p className={SUBTITLE_CLASS}>
                  In order to design high-quality, impactful projects, we need
                  to know who we can count on. We ask members to show up
                  consistently so that we can operate like a team.
                </p>
              </div>
              {/* <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                {COMMITMENT_POINTS.map((point) => (
                  <li
                    key={point}
                    className="border-t border-zinc-200 pt-4 text-base text-zinc-800 lg:text-lg"
                  >
                    {point}
                  </li>
                ))}
              </ul> */}
            </div>
            <div className={MEDIA_COL}>
              <PlaceholderImage label="Commitment image" />
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-white", SECTION_PY)}>
          <div className={SECTION_STACK}>
            <div className={cn(CONTENT_COL, "flex flex-col gap-8")}>
              <div className={TITLE_SUBTITLE_GAP}>
                <h2 className={TITLE_CLASS}>
                  We&apos;re focused on big problems that affect everyone
                </h2>
                <p className={SUBTITLE_CLASS}>
                  We develop projects that address urgent global crises: global
                  poverty, environmental destruction, democratic decline, and
                  dangerous technological development.
                </p>
              </div>
              {/* <ul className="flex w-full max-w-3xl flex-col gap-3">
                {BIG_PROBLEM_POINTS.map((point) => (
                  <li
                    key={point}
                    className="border-l-2 border-zinc-300 pl-4 text-base text-zinc-800 lg:text-lg"
                  >
                    {point}
                  </li>
                ))}
              </ul> */}
            </div>
            <div className={MEDIA_COL}>
              <PlaceholderImage label="Big problems image" />
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-white", SECTION_PY)}>
          <div className={SECTION_STACK}>
            <div className={cn(CONTENT_COL, TITLE_SUBTITLE_GAP)}>
              <h2 className={TITLE_CLASS}>
                We are driven by data and evidence
              </h2>
              <p className={SUBTITLE_CLASS}>
                We approach problem-solving with data and evidence, not ideology
                or political identity. We welcome members of all backgrounds.
              </p>
            </div>
            <div className={MEDIA_COL}>
              <PlaceholderImage label="Evidence / community image" />
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-white", SECTION_PY)}>
          <div className={SECTION_STACK}>
            <div className={cn(CONTENT_COL, TITLE_SUBTITLE_GAP)}>
              <h2 className={TITLE_CLASS}>
                The more members we have, the more we can do
              </h2>
              <p className={SUBTITLE_CLASS}>
                The more people who join us, the more ambitious we can get. In
                the long term, we want to help people unlock their collective
                potential to make rapid, large-scale change.
              </p>
            </div>
            <div
              className={cn(
                MEDIA_COL,
                "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6",
              )}
            >
              {SCALE_EXAMPLES.map((example) => (
                <div key={example} className="flex flex-col gap-3">
                  <PlaceholderImage label={example} className="aspect-[4/3]" />
                  <p className="text-base text-zinc-800 lg:text-lg">
                    {example}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="join" className={cn("w-full bg-white", SECTION_PY)}>
          <div className={MEDIA_COL}>
            <div className="flex flex-col gap-4 rounded-lg bg-zinc-100 px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36">
              <h2 className={TITLE_CLASS}>Request an invite</h2>
              <p className={SUBTITLE_CLASS}>
                Membership is by invitation. Send us an{" "}
                <a
                  href="mailto:contact@worldalliance.org"
                  className="text-link"
                >
                  email
                </a>{" "}
                with a short description of yourself, and we&apos;ll be in
                touch.
              </p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default LandingTestPage;
