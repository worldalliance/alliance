import React, { useEffect, useState } from "react";
import { Link, href, useSearchParams, useNavigate } from "react-router";
import LargeActionCard from "../app/LargeActionCard";
import {
  ProfileDto,
  userReferrerProfile,
  userOnetimeInvite,
} from "@alliance/shared/client";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import posthog from "posthog-js";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import {
  ActionWithAwayStatus,
  TaskAwayStatus,
} from "@alliance/shared/lib/actionUtils";

const InvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const referralCode = searchParams.get("ref");

  const [inviterProfile, setInviterProfile] = useState<ProfileDto | null>(null);
  const [inviteeName, setInviteeName] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<number | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!referralCode) return;
    userReferrerProfile({ path: { code: referralCode } }).then((response) => {
      setInviterProfile(response.data ?? null);
    });

    userOnetimeInvite({ path: { code: referralCode } }).then((response) => {
      console.log(response);
      if (response.data) {
        setInviteeName(response.data.invitee);
        setCommunityId(response.data.community?.id ?? null);
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

  const exampleTask: ActionWithAwayStatus = {
    name: "Ask your local cafe to switch to compostable cups",
    body: "The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements \n\n\n The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements",
    category: "Climate Change",
    id: 1,
    taskFormId: 23,
    useManualCohort: false,
    image: "",
    status: "member_action",
    timeEstimate: 5,
    visibilityMode: "public",
    optional: false,
    usersJoined: 100,
    activities: [],
    shortDescription:
      "We've negotiated a discount with a compostable cup supplier for all cafes that members can convince to use their cups.",
    type: "Activity" as const,
    usersCompleted: 68,
    priority: 0,
    preventCompletion: false,
    everyoneShouldComplete: false,
    shouldCompleteAfterDeadline: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publicOnly: false,
    participatingTags: [],
    updates: [],
    userRelation: "joined" as const,
    canParticipate: true,
    awayStatus: TaskAwayStatus.NOT_AWAY,
    events: [
      {
        id: 1,
        title: "Event 1",
        description: "Event 1 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        newStatus: "member_action",
        suiteManaged: false,
      },
      {
        id: 2,
        title: "Event 2",
        description: "Event 2 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
        newStatus: "member_action",
        suiteManaged: false,
      },
    ],
    commitmentless: false,
  };

  const memberQuotes = [
    {
      quote:
        "On the whole, the world is not going in the right direction. We need new ideas to change that, and the Alliance is just that. But it will work only if we all participate.",
      author: "Anonymous",
    },

    {
      quote:
        "I often worry about the future, and the Alliance provides a platform where I can address these fears by taking direct actions for meaningful change.",
      author: "Anonymous",
    },
    {
      quote:
        "There are countless reasons to doubt its potential for success, but unlikelier movements and worse circumstances have reliably bore fruit. We have to try, to become vessels for our nobler ideals and hopes for the world.",
      author: "Anonymous",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col flex-grow items-center justify-center ">
        <div className="w-full max-w-4xl px-4 md:px-8 py-12 md:py-12">
          <div className="p-4 md:p-18 flex flex-col gap-y-6">
            <div className="mb-4">
              <h2 className="font-serif font-semibold !text-4xl md:!text-5xl text-center mb-4">
                Invitation to the Alliance
              </h2>
              {inviterProfile !== null && (
                <p className="text-center">
                  From {" "}
                  <ProfileImage
                    pfp={inviterProfile?.profilePicture ?? null}
                    size="small"
                  />
                  {" " + inviterProfile?.displayName}
                </p>
              )}
            </div>
            <p>
              {inviteeName ? `Hi ${inviteeName}, ` : ""}I invite you to join me
              as a member of the Alliance. I believe you share my concerns about
              the direction the world is headed, and membership in the Alliance
              is a straightforward, effective way to take action.
            </p>

            <h3 className="!text-2xl font-semibold mt-2">
              What is the Alliance?
            </h3>
            <p>
              We’re a global group of individuals coordinating to solve the
              world&apos;s largest problems, including extreme poverty,
              environmental destruction, the breakdown of democratic
              institutions, and dangerous technological development.
            </p>
            <p>
              Each week, every member of the Alliance spends a small amount of
              time completing tasks on our online platform. These tasks are
              planned by a full-time office that ensures our time is used
              effectively.
            </p>

            <p>Here are some examples of actions we have taken recently:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                The office asked a coalition of businesses to take environmental
                action, promising that we would help them attain a media feature
                if they did. After they took action, we signed a letter to
                journalists requesting a feature of the businesses.
              </li>
              <li>
                We provided actionable feedback on the websites of three
                potential partner non-profits.
              </li>
              <li>We voted on proposals for a small grant.</li>
            </ol>

            <div className="my-4">
              <div className="p-1 md:p-4 md:py-6 bg-zinc-50 mb-2">
                <LargeActionCard
                  action={exampleTask}
                  userRelation={"joined"}
                  friendActivities={[]}
                  handleDismiss={() => {}}
                  onUpdateActionState={() => {}}
                  showDetails={false}
                  className="pointer-events-none transform-[scale(0.9)] bg-white"
                />
              </div>
              <p className="text-center text-sm">
                Example task you would see on the platform
              </p>
            </div>

            <h3 className="font-semibold !text-2xl mt-2">
              Why should you join?
            </h3>
            <p>
              <span className="font-bold">Our model is effective.</span> Members
              make a commitment to complete tasks on time. Since we can trust
              one another to show up, we can execute optimized, complex action
              plans.
            </p>
            <p>
              <span className="font-bold">
                Participation is straightforward.
              </span>{" "}
              Tasks only require 15 minutes per week. The platform breaks down
              each task into simple steps, and you can complete them at your own
              pace.
            </p>
            <p>
              <span className="font-bold">
                We have the potential to become a major global force.
              </span>{" "}
              Right now, we&apos;re running small experiments to test our model
              and strategies. One day, we could have enormous collective power:
              for instance, we could call on millions of members to boycott a
              corporation acting unethically, simultaneously make lifestyle
              changes to curtail waste, or fund new scientific research
              neglected by governments and markets.
            </p>

            <h3 className="font-semibold !text-2xl mt-2">
              What do members say?
            </h3>
            <div className="flex flex-col gap-y-2">
              {memberQuotes.map((memberQuote, index) => (
                <div className="border border-zinc-200 p-4 md:p-6" key={index}>
                  <p>{memberQuote.quote}</p>
                </div>
              ))}
            </div>
            <h3 className="font-semibold !text-2xl mt-2">How do you join?</h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                Skim our{" "}
                <Link to={href("/guide")} target="_blank" className="text-link">
                  guide
                </Link>{" "}
                to understand our structure, process, and governance.
              </li>
              <li>
                Create an account with my{" "}
                <Link
                  to={`${href("/signup")}?ref=${referralCode}`}
                  target="_blank"
                  className="text-link"
                >
                  personal sign-up link
                </Link>
                . We will be added as friends automatically.
                {communityId
                  ? ` You will also be added to my smaller Alliance group.`
                  : ""}
              </li>
              <li>
                Go through the onboarding tasks on your{" "}
                <Link to={href("/tasks")} target="_blank" className="text-link">
                  tasks page
                </Link>
                , which explain how our online process works and what is
                expected of members. Please let me know if you have any
                questions.
              </li>
            </ol>
            <Button
              color={ButtonColor.Black}
              onClick={() => navigate(`${href("/signup")}?ref=${referralCode}`)}
              className="w-full !h-16 !text-lg"
            >
              Sign up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
