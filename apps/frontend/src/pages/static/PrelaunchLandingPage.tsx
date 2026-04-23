import React from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import alliancePeople from "../../assets/alliance_people.webp";
import ewaste from "../../assets/ewaste.webp";
import { userFindOne } from "@alliance/shared/client";
import type { ProfileDto } from "@alliance/shared/client";
import Footer from "../../components/Footer";
import ExamplePriorityCardList from "../../components/ExamplePriorityCardList";
import FeaturedImpactCard from "../../components/FeaturedImpactCard";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { ArrowRight } from "lucide-react";

/** Shared width + horizontal padding for hero copy and sections below. */
const LANDING_MAIN_COL = "mx-auto w-full max-w-4xl px-6 sm:px-10 lg:px-16";
const LANDING_BIG_COL = "px-4 lg:px-32 w-full";

/** Gap between sections + outer vertical padding (avoids stacked py on each section). */
const LANDING_BODY = "gap-16 sm:gap-24 lg:gap-36 py-18 lg:py-28";
const LANDING_SECTION_INNER = "flex flex-col gap-y-6 lg:gap-y-8";

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
      size="large"
      alt={
        profile?.displayName
          ? `${profile.displayName} profile photo`
          : "Member profile photo"
      }
    />
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-row items-start gap-3 border border-grey-1 p-4 sm:p-6 rounded-md">
      <div className="shrink-0">
        {isPending ? (
          <div
            className="size-9 animate-pulse rounded bg-zinc-200"
            aria-hidden
          />
        ) : (
          avatar
        )}
      </div>
      <figure className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <blockquote className="text-base lg:text-lg text-zinc-900 leading-snug">
          {quote}
        </blockquote>
        {profile?.displayName ? (
          <figcaption className="text-sm lg:text-base text-zinc-500">
            {profile.displayName}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}

function HowItWorksCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-zinc-50 p-4 lg:p-6">
      <p className="text-lg font-semibold text-black lg:text-xl">{title}</p>
      <p className="text-base text-zinc-500 lg:text-lg">{children}</p>
    </div>
  );
}

const PrelaunchLandingPage: React.FC = () => {
  const memberQuoteQueries = useMemberQuoteProfiles(
    MEMBER_QUOTES.map((q) => q.memberId),
  );

  return (
    <div className="flex flex-col">
      <section className="relative min-h-dvh w-full overflow-hidden">
        <img
          src={alliancePeople}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-linear-to-t from-black/75 via-black/40 to-black/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-black/80 via-black/45 to-transparent sm:h-44 md:h-52"
          aria-hidden
        />
        <PrelaunchNavbar transparent absolute showLogo />

        <div className="relative z-1 flex min-h-dvh w-full flex-col justify-end pb-10 pt-28 sm:pb-14 lg:pb-20 lg:pt-32">
          <div className={LANDING_MAIN_COL}>
            <p className="font-serif font-semibold text-4xl text-white drop-shadow-sm sm:text-5xl lg:text-7xl">
              The Alliance
            </p>
            <div className="mt-4 flex flex-col gap-y-4 text-lg text-white/95 drop-shadow-sm sm:mt-6 sm:gap-y-5 sm:text-xl lg:text-3xl">
              <p>
                We&apos;re a global group of people cooperating to improve the
                world. Each member contributes a consistent amount of their time
                each week, providing the reliability needed to plan precise,
                effective actions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={`flex flex-1 flex-col bg-white ${LANDING_BODY}`}>
        <section className="w-full flex flex-col gap-8">
          <div className={`${LANDING_MAIN_COL} ${LANDING_SECTION_INNER}`}>
            <div className="flex flex-col gap-4">
              <p className="text-title-large w-full text-black">How we work</p>
              <p className="text-lg text-zinc-500 lg:text-xl">
                We design actions based on the number of members we can count
                on.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
              <HowItWorksCard title="Members">
                Alliance members complete 15 minutes of actions each week over
                our online platform.
              </HowItWorksCard>
              <HowItWorksCard title="Office">
                Our full-time office designs actions in order to achieve a
                measurable impact.
              </HowItWorksCard>
            </div>
          </div>
          <div
            className={`${LANDING_BIG_COL} grid grid-cols-1 gap-2 md:grid-cols-3`}
          >
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
        </section>

        <section className="w-full">
          <div className={`${LANDING_MAIN_COL} ${LANDING_SECTION_INNER}`}>
            <div className="flex flex-col gap-4">
              <p className="text-title-large w-full text-black">
                Our priorities
              </p>
              <p className="text-lg text-zinc-500 lg:text-xl">
                We are focused on global crises that are interconnected, affect
                billions of people, and are possible to solve with coordinated
                action.
              </p>
            </div>
            <ExamplePriorityCardList
              bgColor="grey"
              dropdown
              titleClass="text-base lg:text-lg"
            />
          </div>
        </section>
        <section className="w-full">
          <div className={`${LANDING_MAIN_COL} ${LANDING_SECTION_INNER}`}>
            <div className="flex flex-col gap-4">
              <p className="text-title-large w-full text-black">Our impact</p>
              <p className="text-lg text-zinc-500 lg:text-xl">
                At this stage, we are taking small-scale actions in order to
                learn and build our processes.
              </p>
            </div>
          </div>
          <div className={`${LANDING_BIG_COL} flex flex-col mt-8 md:mt-12`}>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {FEATURED_IMPACT_ACTIONS.slice(0, 4).map((action) => (
                  <FeaturedImpactCard key={action.actionId} {...action} />
                ))}
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:items-start text-link">
                <Link
                  to="/progress"
                  className="whitespace-nowrap text-link text-lg flex flex-row items-center gap-x-1"
                >
                  See more
                </Link>
                <ArrowRight className="w-4 h-4 " />
              </div>
            </div>
          </div>
          <div className={`${LANDING_BIG_COL} mt-8 md:mt-12`}>
            <div className="max-w-5xl mx-auto flex flex-col gap-4">
              <img
                src={ewaste}
                alt="E-waste"
                className="w-full h-full object-cover"
              />
              <p className="text-lg text-zinc-500 text-left sm:text-center flex flex-row items-center justify-center gap-1">
                We collected and recycled 57 kg (126 lbs) of e-waste.{" "}
                <Link to="/actions/60" className="text-link">
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="w-full">
          <div className={`${LANDING_MAIN_COL} ${LANDING_SECTION_INNER}`}>
            <div className="flex flex-col gap-4">
              <p className="text-title-large w-full text-black">Join us</p>
              <p className="text-zinc-500 text-lg lg:text-xl">
                Membership is currently by invitation only. If you are
                interested in becoming a member, please{" "}
                <a
                  href="mailto:contact@worldalliance.org"
                  className="text-link"
                >
                  email us
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
      <Footer className="bg-white" />
    </div>
  );
};

export default PrelaunchLandingPage;
