import type { ProfileDto } from "@alliance/shared/client";
import { userFindOne } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useQueries } from "@tanstack/react-query";
import React from "react";
import { Link } from "react-router";

import alliancePeople1280 from "../../assets/alliance_people-1280.webp";
import alliancePeople640 from "../../assets/alliance_people-640.webp";
import alliancePeople960 from "../../assets/alliance_people-960.webp";
import alliancePeople from "../../assets/alliance_people.webp";

import officeImage from "../../assets/office.jpg";
import rubyImage from "../../assets/ruby.jpg";

import { ArrowRightIcon } from "lucide-react";
import AllianceIntroYouTubeEmbed from "../../components/AllianceIntroYouTubeEmbed";
import ExamplePriorityCardList from "../../components/ExamplePriorityCardList";
import FeaturedImpactCard from "../../components/FeaturedImpactCard";
import Footer from "../../components/Footer";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import { exampleMemberTaskAction } from "../../lib/exampleMemberTaskAction";
import { exampleMemberTaskFormSchema } from "../../lib/exampleMemberTaskFormSchema";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import LargeActionCard from "../app/LargeActionCard";
import {
  LANDING_PAGE_STACK,
  LANDING_QUOTES_COL,
  LANDING_SECTION,
  LANDING_SECTION_PY,
  SECTION_TITLE_CLASS,
  SUBTITLE_CLASS,
} from "./prelaunchLayout";

export function meta() {
  return socialPreviewMeta({
    title:
      "The Alliance — A global group of people cooperating to improve the world",
    description:
      "A global group of people cooperating to improve the world. Members spend 15 minutes a week completing thoughtfully designed actions for measurable impact.",
    image: "/og-home.png",
    url: "/",
  });
}

const MEMBER_QUOTES = [
  {
    quote:
      "I am convinced that the Alliance offers the platform for maximizing the impact of my time and energy contribution to the world over time. I want to be part of it and grow with it. They take your commitment seriously and will hold your feet to the fire. But it's just a few minutes per week and I've found every project thus far to be self-enriching and meaningful.",
    memberId: 96,
  },
  {
    quote:
      "On the whole, the world is not going in the right direction. We need new ideas to change that, and the Alliance is just that. But it will work only if we all participate.",
    memberId: 33,
  },

  {
    quote:
      "There is an inability to leverage collective will towards problems that almost everybody agrees exist (severe wealth inequality; climate change; political polarization to name a few). I think this is mostly the result of individuals not having clear actions that can affect the relevant issues. The Alliance is the natural solution to this.",
    memberId: 55,
  },
];

const FEATURED_IMPACT_ACTIONS_IDS = [14, 75, 56, 84, 64, 95];

function useMemberQuoteProfiles(memberIds: number[]) {
  return useQueries({
    queries: memberIds.map((memberId) => ({
      queryKey: ["user", "slug", memberId],
      queryFn: () =>
        userFindOne({ path: { id: memberId } }).then(
          (r) => (r.data ?? null) as ProfileDto | null,
        ),
      staleTime: 60 * 60 * 1000,
    })),
  });
}

function MemberQuoteCard({
  quote,
  profile,
  isPending,
}: {
  memberId: number;
  quote: string;
  profile: ProfileDto | null;
  isPending: boolean;
}) {
  const avatar = (
    <AvatarProfile
      pfp={profile?.profilePicture ?? null}
      size="override"
      className="w-12 h-12 rounded"
      alt={
        profile?.displayName
          ? `${profile.displayName} profile photo`
          : "Member profile photo"
      }
    />
  );

  return (
    <div className="flex h-full w-full flex-col rounded-lg bg-green-bg-card p-5 sm:p-6">
      <figure className="flex flex-1 flex-col justify-between gap-6">
        <div className="relative">
          <span
            className="pointer-events-none absolute top-0 left-0 font-serif text-4xl leading-none text-white/35 select-none lg:text-7xl"
            aria-hidden
          >
            &ldquo;
          </span>
          <blockquote className="pt-5 text-base leading-normal text-white lg:pt-12 lg:text-lg">
            {quote}
          </blockquote>
        </div>
        <figcaption className="flex shrink-0 flex-row items-center gap-3">
          <div className="shrink-0">
            {isPending ? (
              <div
                className="size-12 animate-pulse rounded bg-white/20"
                aria-hidden
              />
            ) : (
              avatar
            )}
          </div>
          {profile?.displayName ? (
            <span className="text-sm font-medium text-white/75 lg:text-base">
              {profile.displayName}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </div>
  );
}

function HowItWorksCard({
  title,
  subtitle,
  content,
  image,
}: {
  title: string;
  subtitle: string;
  content: string;
  image: string;
}) {
  return (
    <div className="flex h-full flex-col gap-1 rounded-md bg-white p-6 sm:p-8">
      <img src={image} alt={title} className="w-full h-auto rounded-md mb-4" />
      <div className="flex flex-col gap-1">
        <p className="font-serif text-xl font-semibold text-zinc-900 lg:text-2xl">
          {title}
        </p>
        <p className="text-base text-zinc-500 lg:text-xl">{subtitle}</p>
      </div>
      <p className="text-base text-zinc-800 lg:text-xl mt-2">{content}</p>
    </div>
  );
}

const PrelaunchLandingPage: React.FC = () => {
  useWhiteBackground();

  const memberQuoteQueries = useMemberQuoteProfiles(
    MEMBER_QUOTES.map((q) => q.memberId),
  );

  return (
    <div className="flex flex-col bg-white">
      <div className={LANDING_PAGE_STACK}>
        <PrelaunchNavbar transparent={false} absolute={false} />
        <section
          className={cn("relative w-full bg-white", "pb-12 md:pb-16 lg:pb-20")}
        >
          <div
            className={cn(
              LANDING_QUOTES_COL,
              "flex flex-col gap-8 pt-6 sm:pt-8 md:gap-10 lg:flex-row lg:items-center lg:gap-24 lg:pt-12",
            )}
          >
            <div className="flex min-w-0 w-full flex-col gap-y-4 lg:w-1/2 lg:items-start">
              <div className="flex flex-col gap-y-4 lg:gap-y-8">
                <p className="text-center font-serif lg:leading-18 font-semibold text-2xl text-zinc-900 sm:gap-y-5 sm:text-4xl lg:text-left lg:text-6xl">
                  Working together to end global crises
                </p>

                <div className="flex flex-col gap-y-4">
                  <p className="text-center lg:text-left text-lg lg:text-2xl text-zinc-900">
                    We are a global group of people who coordinate online to
                    address problems that affect billions. We take regular
                    actions designed to achieve clear outcomes. Right now, we
                    are in an experimental phase.
                  </p>
                </div>
                <div className="flex flex-row items-center gap-4">
                  <Link
                    to="#join-us"
                    className="mx-auto font-semibold self-start rounded-md bg-green-bg-card px-4 py-3 lg:px-8 lg:py-6 text-base text-white hover:bg-green-bg lg:mx-0 lg:text-2xl"
                  >
                    <p>Join us</p>
                  </Link>
                </div>
              </div>
            </div>
            <figure className="min-w-0 w-full lg:w-1/2">
              <img
                src={alliancePeople}
                srcSet={`${alliancePeople640} 640w, ${alliancePeople960} 960w, ${alliancePeople1280} 1280w, ${alliancePeople} 2000w`}
                sizes="(min-width: 1024px) 50vw, (min-width: 768px) 86vw, 100vw"
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
        </section>

        <section className={cn("w-full bg-grey-0", LANDING_SECTION_PY)}>
          <div className={LANDING_SECTION}>
            <div className="flex flex-col gap-4">
              <p className={SECTION_TITLE_CLASS}>How we work</p>
              <p className={SUBTITLE_CLASS}>
                We ask members to be dependable. As a result, we can plan
                effective actions that take advantage of predictable
                participation.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <HowItWorksCard
                title="Office"
                subtitle="Designing rigorous, effective actions"
                image={officeImage}
                content="Our full-time team prepares actions for members to take. We strive to achieve clear outcomes and rigorously evaluate costs and benefits."
              ></HowItWorksCard>
              <HowItWorksCard
                title="Members"
                subtitle="Completing actions dependably"
                image={rubyImage}
                content="Alliance members complete actions on our online platform.
                Participation currently requires a weekly commitment of 15 minutes."
              ></HowItWorksCard>
            </div>
            <div className="flex flex-col mt-4 gap-8 lg:gap-16">
              <p className={SUBTITLE_CLASS}>
                Members complete actions on our web and mobile apps.
              </p>
              <div className="flex flex-col gap-4">
                <div className="p-2 md:p-4 lg:p-10 bg-green/5 rounded-md">
                  <LargeActionCard
                    action={exampleMemberTaskAction}
                    staticTaskFormSchema={exampleMemberTaskFormSchema}
                    userRelation="none"
                    onUpdateActionState={() => {}}
                    onCompleteAction={() => {}}
                    showDetails={false}
                    className="pointer-events-none transform-[scale(0.9)] bg-white drop-shadow-xl drop-shadow-zinc-100"
                  />
                </div>
                <p className="text-center text-zinc-500 text-base">
                  Example task a member might see on the platform
                </p>
              </div>
            </div>
            <div className="flex flex-col mt-4 gap-8 lg:gap-16">
              <p className={SUBTITLE_CLASS}>
                In the long term, we aim to help people unlock their potential
                to make rapid, large-scale change.
              </p>
              <AllianceIntroYouTubeEmbed />
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-green-bg", LANDING_SECTION_PY)}>
          <div className={LANDING_QUOTES_COL}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MEMBER_QUOTES.map((item, index) => (
                <MemberQuoteCard
                  key={`${item.memberId}-${index}`}
                  memberId={item.memberId}
                  quote={item.quote}
                  profile={memberQuoteQueries[index]?.data ?? null}
                  isPending={memberQuoteQueries[index]?.isPending ?? true}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={cn("w-full bg-grey-0", LANDING_SECTION_PY)}>
          <div className={LANDING_SECTION}>
            <div className="flex flex-col gap-4">
              <p className={SECTION_TITLE_CLASS}>Our priorities</p>
              <p className={SUBTITLE_CLASS}>
                We focus on global crises that are interconnected, affect
                billions of people, and are possible to solve with coordinated
                action.
              </p>
            </div>
            <ExamplePriorityCardList titleClass="text-lg lg:text-xl" />
          </div>
        </section>

        <section className={cn("w-full bg-white", LANDING_SECTION_PY)}>
          <div className={LANDING_SECTION}>
            <div className="flex flex-col gap-4">
              <p className={SECTION_TITLE_CLASS}>Our impact</p>
              <div className="flex flex-col gap-2">
                <p className={SUBTITLE_CLASS}>
                  At this stage, we are taking small-scale actions in order to
                  learn and build our processes.
                </p>
                <Link
                  to="/progress"
                  className="mx-auto self-start flex flex-row items-center gap-1 underline"
                >
                  <p className="whitespace-nowrap flex flex-row items-center gap-x-1 text-lg lg:text-xl">
                    See more <ArrowRightIcon className="size-5" />
                  </p>
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="columns-1 sm:columns-2 gap-2 *:break-inside-avoid *:mb-2">
                {FEATURED_IMPACT_ACTIONS.filter((action) =>
                  FEATURED_IMPACT_ACTIONS_IDS.includes(action.actionId),
                )
                  .slice()
                  .sort(
                    (a, b) =>
                      FEATURED_IMPACT_ACTIONS_IDS.indexOf(a.actionId) -
                      FEATURED_IMPACT_ACTIONS_IDS.indexOf(b.actionId),
                  )
                  .map((action) => (
                    <FeaturedImpactCard key={action.actionId} {...action} />
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="join-us"
          className={cn("w-full bg-grey-0", LANDING_SECTION_PY)}
        >
          <div className={LANDING_SECTION}>
            <div className="flex flex-col gap-4 my-12">
              <p className={SECTION_TITLE_CLASS}>Join us</p>
              <p className={SUBTITLE_CLASS}>
                Membership is currently by invitation only, and requires a
                15-minute weekly commitment. If you&apos;d like to join, please
                send us an{" "}
                <a
                  href="mailto:contact@worldalliance.org"
                  className="text-link"
                >
                  email
                </a>{" "}
                with a short description of yourself.
              </p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default PrelaunchLandingPage;
