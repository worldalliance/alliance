import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import LargeActionCard from "../app/LargeActionCard";
import { ActionWithRelation } from "../../applayout";
import {
  ProfileDto,
  userReferrerProfile,
  userInviteeName,
} from "@alliance/shared/client";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import posthog from "posthog-js";

const InvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const referralCode = searchParams.get("ref");

  const [inviterProfile, setInviterProfile] = useState<ProfileDto | null>(null);
  const [inviteeName, setInviteeName] = useState<string | null>(null);

  useEffect(() => {
    if (!referralCode) return;
    userReferrerProfile({ path: { code: referralCode } }).then((response) => {
      setInviterProfile(response.data ?? null);
    });

    userInviteeName({ path: { code: referralCode } }).then((response) => {
      if (response.data && typeof response.data === "string") {
        setInviteeName(response.data);
      } else {
        setInviteeName(null);
      }
    });

    posthog.register_once({
      referral_code: referralCode,
    });
    posthog.capture("invite_page_opened", {
      referral_code: referralCode,
    });
  }, [referralCode]);

  if (!referralCode) {
    return (
      <div className="min-h-screen flex flex-col bg-page">
        <div className="flex flex-col flex-grow items-center justify-center ">
          <div className="w-full text-xl text-center max-w-md px-8">
            <p>Invalid invite</p>
          </div>
        </div>
      </div>
    );
  }

  const exampleTask: ActionWithRelation = {
    name: "Ask your local cafe to switch to compostable cups",
    body: "The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements \n\n\n The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements",
    category: "Climate Change",
    id: 1,
    taskFormId: 23,
    image: "",
    status: "member_action",
    timeEstimate: 5,
    usersJoined: 100,
    activities: [],
    shortDescription:
      "We've negotiated a discount with a compostable cup supplier for all cafes that members can convince to use their cups.",
    type: "Activity" as const,
    usersCompleted: 68,
    everyoneShouldComplete: false,
    archived: false,
    participatingGroups: [],
    updates: [],
    relation: "joined" as const,
    canParticipate: true,
    events: [
      {
        id: 1,
        title: "Event 1",
        description: "Event 1 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        newStatus: "member_action",
        showInTimeline: true,
        suiteManaged: false,
      },
      {
        id: 2,
        title: "Event 2",
        description: "Event 2 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
        newStatus: "member_action",
        showInTimeline: true,
        suiteManaged: false,
      },
    ],
    commitmentless: false,
  };

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <div className="flex flex-col flex-grow items-center justify-center ">
        <div className="w-full max-w-4xl px-4 md:px-8 py-12 md:py-24">
          <h2 className="font-serif !text-4xl text-center mb-4 mx-4">
            Invitation to the Alliance
          </h2>
          {inviterProfile !== null && (
            <p className="text-center">
              From your friend{" "}
              <ProfileImage
                pfp={inviterProfile?.profilePicture ?? null}
                size="small"
              />
              {" " + inviterProfile?.displayName}
            </p>
          )}

          <Card
            className="p-4 md:p-12 flex flex-col gap-y-6 mt-8"
            style={CardStyle.White}
          >
            <p>
              {inviteeName ? `Hi ${inviteeName}, ` : ""}I hope you will join me
              as a member of the Alliance. I believe you share my concerns about
              the direction that the world is headed, and I think this is an
              opportunity to make a significant difference.
            </p>

            <h3 className="font-serif !text-3xl font-bold mt-2">Why join?</h3>

            <p>
              <span className="font-bold">
                We’re a global group of individuals
              </span>{" "}
              learning to coordinate to advance humanity’s interests. We plan to
              fight extreme poverty, environmental destruction, the breakdown of
              democratic institutions, and dangerous technological development.
              Today, we are in an experimental phase focused on learning rather
              than growth.
            </p>
            <p>
              <span className="font-bold">Our unique model</span> is designed to
              enable durable, strategic cooperation that can start small,
              iterate quickly, and grow over time.
            </p>
            <ol className="list-decimal list-inside space-y-3 ">
              <li>
                Members commit to give a reliable fraction of their time. Right
                now, this is 15 minutes per week.
              </li>
              <li>
                A strategic office prepares high-impact collective actions
                following a democratic assessment of priorities.
              </li>
            </ol>
            <p>
              <span className="font-bold">Imagine if millions of people</span>{" "}
              could instantly boycott a corporation acting unethically, or
              collectively make lifestyle changes to curtail waste, or fund new
              scientific research neglected by governments and markets. This is
              the kind of flexible power we hope to build together.
            </p>
            <p>
              <span className="font-bold">
                This is an important time to join.
              </span>{" "}
              If we eventually succeed, it will be because friends and family
              were willing to step up before success was guaranteed. In
              addition, early members will have an outsized influence on our
              approach and culture.
            </p>

            <h3 className="font-serif !text-3xl font-bold mt-2">
              What do you need?
            </h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <span className="font-bold">
                  A willingness to take our world&apos;s problems seriously.
                </span>{" "}
                We need a shared belief that these problems are not right, and
                therefore a readiness to take actions that require meaningful
                effort. This shared belief will allow us to address
                disagreements with respect and reasoned deliberation.
              </li>
              <li>
                <span className="font-bold">
                  A willingness to make and keep a promise.
                </span>{" "}
                If we can trust every member to follow through on their
                commitments, we can make ambitious and complex plans that rely
                on one another.
              </li>
            </ol>
            <h3 className="font-serif !text-3xl font-bold mt-2">
              What would you do?
            </h3>
            <p>
              <span className="font-bold">
                Every week, you would log into our online platform to complete
                collective actions
              </span>
              .
            </p>

            <p>
              For instance, we recently signed a letter requesting news coverage
              of a coalition of businesses that took environmental action at the
              request of our strategic office. Other example actions include:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Providing actionable feedback on the website of a partner
                non-profit.
              </li>
              <li>
                Reading about global problems and discussing with each other.
              </li>
              <li>Editing Alliance communications materials.</li>
            </ol>

            <div className="my-4">
              <div className="p-1 md:p-4 md:py-6 bg-zinc-50 mb-2">
                <LargeActionCard
                  action={exampleTask}
                  userRelation={"joined"}
                  friendActivities={[]}
                  onUpdateActionState={() => {}}
                  showDetails={false}
                  className="pointer-events-none transform-[scale(0.9)]"
                />
              </div>
              <p className="text-center text-sm">
                Example task you would see on the platform
              </p>
            </div>

            <h3 className="font-serif !text-3xl font-bold mt-2">
              How do you join?
            </h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                Skim our
                <Link to="/guide" target="_blank">
                  <div className="inline-block py-0.5 px-2 mx-2 border border-green hover:bg-zinc-50 rounded-md font-medium shadow mx-1 text-green">
                    guide
                  </div>
                </Link>
                to understand our structure, process, and governance.
              </li>
              <li>
                Create an account with my
                <Link to={`/signup?ref=${referralCode}`} target="_blank">
                  <div className="inline-block py-0.5 px-2 mx-2 border border-green hover:bg-zinc-50 rounded-md font-medium shadow mx-1 text-green">
                    personal sign-up link
                  </div>
                </Link>
                . We will be automatically added as friends.
              </li>
              <li>
                Go through the onboarding tasks on your{" "}
                <Link to="/tasks" target="_blank">
                  <div className="inline-block py-0.5 px-2 mx-2 border border-green hover:bg-zinc-50 rounded-md font-medium shadow mx-1 text-green">
                    tasks page
                  </div>
                </Link>
                , which explain how our online process works and what is
                expected of members. Please let me know if you have any
                questions!
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
