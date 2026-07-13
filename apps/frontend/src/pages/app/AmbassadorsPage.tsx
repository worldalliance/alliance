import React from "react";
import { Link } from "react-router";
import ambassadorInviteQrCode from "../../assets/ambassador-invite-qr-code.png";
import ambassadorInvitationGoal from "../../assets/ambassador-invitation-goal.png";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import InfoSubpage from "../../components/InfoSubpage";
import { TocSection } from "../../components/TableOfContents";

const sectionClassName = "gap-y-4 flex flex-col";
const headingClassName = "mt-2 text-title-medium text-black";
const subheadingClassName = "text-title-small text-black mt-2";
const listClassName = "list-disc list-inside space-y-2 pl-4";
const orderedListClassName = "list-decimal list-inside space-y-3 pl-4";
const quoteClassName =
  "border-l-4 border-zinc-200 pl-4 text-zinc-700 space-y-3";
const imageFrameClassName =
  "flex flex-col items-center justify-center p-4 md:p-6 bg-zinc-50 rounded";
const imageClassName = "w-full h-auto border border-zinc-200 rounded";
const imageCaptionClassName = "text-zinc-500 text-sm text-center";

const AmbassadorsPage: React.FC = () => {
  useWhiteBackground();

  const tocSections: TocSection[] = [
    { id: "about", label: "About", level: 1 },
    { id: "role", label: "Ambassador role", level: 2 },
    { id: "step-by-step", label: "Step-by-step", level: 2 },
    { id: "onboarding", label: "Onboarding", level: 3 },
    { id: "monthly-routine", label: "Monthly routine", level: 3 },
    { id: "who-to-invite", label: "Who to invite", level: 2 },
    { id: "known-people", label: "People you know", level: 3 },
    { id: "new-connections", label: "New connections", level: 3 },
    { id: "craft-invites", label: "Craft invites", level: 2 },
    { id: "example-invites", label: "Example invites", level: 3 },
    { id: "tailoring", label: "Tailoring", level: 3 },
    { id: "talking-points", label: "Talking points", level: 2 },
    { id: "following-up", label: "Following up", level: 2 },
    { id: "invite-tools", label: "Invite tools", level: 2 },
    { id: "resume-linkedin", label: "Resume & LinkedIn", level: 2 },
  ];

  return (
    <InfoSubpage tocSections={tocSections}>
      <section className={sectionClassName}>
        <h1 id="about" className="text-title-large mb-2">
          Ambassador Guide
        </h1>
        <p>
          The Ambassador Program introduces the Alliance to people around the
          world. Many people want to make a difference. We want to connect them
          with a simple, effective way to do so together.
        </p>
        <p>
          This program is experimental. We hope to learn about what kinds of
          invitations work, and what support ambassadors need.
        </p>
        <p className="font-semibold">
          To join, email Grant at{" "}
          <a href="mailto:grant@worldalliance.org" className="text-link">
            grant@worldalliance.org
          </a>
          .
        </p>

        <h2 id="role" className={headingClassName}>
          The Ambassador role
        </h2>
        <p>We ask that Ambassadors:</p>
        <ol className={orderedListClassName}>
          <li>
            Join a monthly 30-minute check-in call with an Alliance staff member
            to do goal-setting.
          </li>
          <li>Do their best to reach their monthly goals.</li>
          <li>Share learnings with one another in the Alliance Slack.</li>
        </ol>
        <p>
          Most ambassadors should start with a goal of{" "}
          <span className="font-semibold">5 successful invitations per month</span>
          . On average, for every 5 invites sent, 1 yields a successful
          invitation, so ambassadors should aim to reach out to about{" "}
          <span className="font-semibold">25 people per month</span>.
        </p>
        <p className="font-semibold">
          A successful invitation is someone who makes an Alliance account and
          signs their membership contract.
        </p>

        <h2 id="step-by-step" className={headingClassName}>
          Step-by-step
        </h2>
        <p>Here is how we recommend getting started.</p>

        <h3 id="onboarding" className={subheadingClassName}>
          Onboarding
        </h3>
        <p>
          Email Grant (
          <a href="mailto:grant@worldalliance.org" className="text-link">
            grant@worldalliance.org
          </a>
          ) to set up a brief onboarding call.
        </p>
        <p>
          He will walk through the program and add you to the Slack. He will
          also give you your Ambassador role tag on the platform, granting you
          access to an Ambassador dashboard.
        </p>

        <h3 id="monthly-routine" className={subheadingClassName}>
          Monthly routine
        </h3>
        <ol className={orderedListClassName}>
          <li>
            Schedule a brief chat with Grant to reflect on the previous month,
            set a new goal, and plan for outreach.
          </li>
          <li>
            Set and track monthly goals in your Ambassador dashboard near the
            bottom of the Invites page.
          </li>
          <li>
            Find people to invite: your own contacts and social media,
            serendipitous connections, or dedicated meetings and events you
            host.
          </li>
          <li>
            Send invitations using invite links from the Invites page, with a
            personalized Alliance explanation for each person.
          </li>
          <li>
            Follow up on invites, usually around 1 week after the initial
            conversation.
          </li>
          <li>
            Share your findings in the Alliance Slack. Grant will invite you
            during onboarding, and you can reach out to him if you need another
            invite.
          </li>
        </ol>

        <h2 id="who-to-invite" className={headingClassName}>
          Who to invite
        </h2>
        <p>
          You can invite anyone who you think would be interested in making a
          difference with the Alliance.
        </p>
        <p>General recommendations:</p>
        <ul className={listClassName}>
          <li>
            Start by inviting people already in your network. Once you have
            reached out to most of the people you know who would likely be
            interested, you can shift your focus towards building new
            connections.
          </li>
          <li>
            Cast a wide net, rather than solely inviting people you think are
            altruistic or civically engaged. While these invites are valuable,
            many of our most dependable members have no previous experience
            participating in similar efforts.
          </li>
          <li>
            Invitations are partly a matter of numbers. Many people will not
            respond. Some will respond but not join. Some will join but not
            finish onboarding. This is normal, so invite broadly.
          </li>
        </ul>

        <h3 id="known-people" className={subheadingClassName}>
          People you already know
        </h3>
        <p>Good candidates include:</p>
        <ul className={listClassName}>
          <li>Friends</li>
          <li>Family</li>
          <li>Classmates, past and present</li>
          <li>Coworkers, past and present</li>
          <li>Club members</li>
        </ul>
        <p>
          We have found that members have had a lot of success reaching out to
          people they have not talked to in a long time. If this is something
          you are comfortable with, we highly recommend it.
        </p>
        <p>
          Checking people lists is a good exercise: scroll through your
          contacts, Instagram followers, and LinkedIn connections. Invite
          broadly, then focus more attention on people who respond or seem
          interested.
        </p>

        <h3 id="new-connections" className={subheadingClassName}>
          Making new connections
        </h3>
        <p>
          There are many ways to invite people outside your personal network.
          These include both serendipitous connections as well as deliberate
          outreach. For example, you could:
        </p>
        <ul className={listClassName}>
          <li>Mention the Alliance to people you meet at various events.</li>
          <li>Present to a club, class, house, dorm, or student group.</li>
          <li>Table on a college campus or in a public area.</li>
          <li>Attend or host an event to talk about the Alliance.</li>
        </ul>
        <p>
          The Alliance is open to funding certain in-person outreach efforts. If
          food, space, printing, tabling materials, or other costs would help
          you with invitations, please ask us if we can support you.
        </p>

        <h2 id="craft-invites" className={headingClassName}>
          How to craft invites
        </h2>

        <h3 id="example-invites" className={subheadingClassName}>
          Example invites
        </h3>
        <p>Invites work best when they are specific to the person.</p>
        <p>It is usually good to explain:</p>
        <ul className={listClassName}>
          <li>Why you thought of them.</li>
          <li>What the Alliance is.</li>
          <li>How to join.</li>
        </ul>
        <p>
          Many members have joined after being sent a casual invite from a
          trusted friend. For example:
        </p>
        <blockquote className={quoteClassName}>
          <p>
            Do you want to join an online community I am part of that does small
            weekly tasks to help the world? Alice and Bob are also members. The
            tasks are pretty easy and you can do them at your own pace. You can
            join here: [link]
          </p>
        </blockquote>
        <p>
          Some invites should include more information about the Alliance. For
          example:
        </p>
        <blockquote className={quoteClassName}>
          <p>
            Hi Alice! I am reaching out because I know you are worried about the
            state of the world, and I think you might be interested in something
            I joined recently.
          </p>
          <p>
            I am part of an online group called the Alliance (
            <a href="https://worldalliance.org/" className="text-link">
              https://worldalliance.org/
            </a>
            ). Members spend 15 minutes a week taking coordinated actions that
            improve the world.
          </p>
          <p>
            It is still early, so our actions are mostly experimental. In the
            past, we helped run a large-scale study on eating less animal
            products with Stanford researcher Seth Ariel Green:{" "}
            <a href="https://plantbasedstudy.org/" className="text-link">
              https://plantbasedstudy.org/
            </a>
            . We also created a public map of police surveillance spending in
            California:{" "}
            <a href="https://ca-police-ai.netlify.app/" className="text-link">
              https://ca-police-ai.netlify.app/
            </a>
            .
          </p>
          <p>
            I learned about this through a friend, and I joined because it
            seemed like an easy way to do something meaningful. I think you
            would enjoy it too. Here is an invite link, if you are interested:
            [link]
          </p>
        </blockquote>

        <h3 id="tailoring" className={subheadingClassName}>
          Tailoring your invite
        </h3>
        <p>
          You know the person you are inviting best. Use your judgment to decide
          which parts of the Alliance to emphasize.
        </p>
        <p>
          Some people like how easy it is to participate: actions take up to 15
          minutes a week and usually come with clear step-by-step instructions.
        </p>
        <p>
          Others are excited by the long-term potential: if the Alliance grows,
          a reliable base of members could become a serious force for good.
        </p>
        <p>
          People also may respond to our expert guidance, the chance to join
          early, our community, or the ability to participate with friends and
          family.
        </p>

        <h2 id="talking-points" className={headingClassName}>
          Talking points
        </h2>
        <h3 className={subheadingClassName}>Actions</h3>
        <p>
          It can be helpful to give some examples of actions. In the past, we
          have:
        </p>
        <ul className={listClassName}>
          <li>
            Run the first ever large-scale behavioral study on eating less
            animal products, alongside Stanford researcher Seth Ariel Green:{" "}
            <a href="https://plantbasedstudy.org/" className="text-link">
              https://plantbasedstudy.org/
            </a>
          </li>
          <li>
            Created a comprehensive public map on police surveillance spending
            in California, the first of its kind:{" "}
            <a href="https://ca-police-ai.netlify.app/" className="text-link">
              https://ca-police-ai.netlify.app/
            </a>
          </li>
          <li>
            Temporarily avoided unnecessary purchases in order to donate more
            than $2,500 collectively to Helen Keller International.
          </li>
          <li>
            Posted 3 expert- and member-informed comments on US federal dockets
            about AI policy.
          </li>
          <li>
            Held a discussion with current and former EPA employees about the
            repeal of the Endangerment Finding.
          </li>
        </ul>

        <h3 className={subheadingClassName}>Reliability and contract</h3>
        <p>
          People may ask why there is a consistent commitment and why there is a
          contract. Some points to emphasize include:
        </p>
        <ul className={listClassName}>
          <li>Reliability is what lets the Alliance plan actions precisely.</li>
          <li>It also lets members know they can count on each other.</li>
          <li>The commitment is capped at 15 minutes per week.</li>
          <li>Members can suspend their contract at any time.</li>
          <li>
            Members can mark themselves away for emergencies, travel, vacation,
            or other conflicts.
          </li>
          <li>
            Members can opt out of actions they believe are immoral or that take
            longer than 15 minutes.
          </li>
        </ul>

        <h3 className={subheadingClassName}>Experts</h3>
        <p>
          Some people find it helpful to hear that the Alliance is supported by
          experts who provide general guidance as well as help us design
          specific actions.
        </p>
        <p>
          Here is our list of experts who have chosen to make their information
          public:{" "}
          <Link to="/people#expert-group" className="text-link">
            worldalliance.org/people#expert-group
          </Link>
          .
        </p>
        <p>
          In general, it can be helpful to emphasize that the Alliance takes
          rigor and effectiveness seriously. Experts are part of how we do this.
        </p>

        <h3 className={subheadingClassName}>Roadmap</h3>
        <p>
          The Alliance is currently focused on learning from early actions. The
          goal is to understand how to grow and sustain the platform, which
          types of actions work, how members respond, and what systems need to
          improve before scaling.
        </p>
        <p>
          This learning phase is meant to build toward an eventual public
          launch, which we currently expect in around a year, with around 10,000
          members.
        </p>
        <p>
          After public launch, the priority will shift from learning toward
          direct impact. At that scale, the Alliance could attempt much more
          ambitious actions: coordinated consumer shifts, pooled funding for
          large projects, mass public comments, pressure campaigns, citizen
          science projects, ecosystem restoration, or synchronized changes in
          how members spend money and time.
        </p>

        <h2 id="following-up" className={headingClassName}>
          Following up
        </h2>
        <p>
          Following up on invites is just as important as initial outreach.
          People are busy, so invites can get buried even if someone is
          interested. We have found that following up can roughly double your
          rate of successful invitations.
        </p>
        <p>Here are some general follow-up tips:</p>
        <ul className={listClassName}>
          <li>
            <span className="font-semibold">Wait around 1 week to follow up:</span>{" "}
            this is usually a good balance between giving them time to think and
            keeping the conversation warm. This depends on the person.
          </li>
          <li>
            <span className="font-semibold">Keep follow-ups low pressure:</span>{" "}
            in follow-ups, it is good to emphasize that they can say no. People
            pressured into joining will likely drop off soon after.
          </li>
          <li>
            <span className="font-semibold">Do not badger:</span> this depends
            on the person, but we usually recommend only following up once. If
            someone does not join after your first follow-up, your time is
            probably better spent on fresh invites.
          </li>
        </ul>
        <p>Example follow-up:</p>
        <blockquote className={quoteClassName}>
          <p>
            Hey [Name]! Just following up on the Alliance invite I sent last
            week. No pressure at all to join, but please let me know either way.
            Thanks!
          </p>
        </blockquote>

        <h2 id="invite-tools" className={headingClassName}>
          Invite tools
        </h2>
        <h3 className={subheadingClassName}>Creating invite links</h3>
        <p>
          Invites can be created on the{" "}
          <Link to="/invites" className="text-link">
            Invites page
          </Link>
          . This page also allows you to:
        </p>
        <ul className={listClassName}>
          <li>Create invite links for individuals.</li>
          <li>Track who you have invited.</li>
          <li>Track collective progress towards our current growth goal.</li>
          <li>
            Preview the invite link you will send, which now includes more
            information about the Alliance.
          </li>
        </ul>
        <p>
          When you create invites, you have the option to invite them to your
          own group.{" "}
          <span className="font-semibold">We highly recommend this</span> - new
          members usually have a better experience when they personally know
          their group lead.
        </p>
        <p>
          If you are inviting in person, the invite page on our new mobile app
          has a QR code that will pull up your invite link.
        </p>
        <div className="flex flex-col items-center justify-center gap-y-2">
          <div className={imageFrameClassName}>
            <img
              src={ambassadorInviteQrCode}
              alt="Mobile invite page showing a QR code for sharing an Alliance invite link"
              className="w-full max-w-md h-auto border border-zinc-200 rounded"
            />
          </div>
          <p className={imageCaptionClassName}>
            The mobile app can show a QR code for in-person invitations.
          </p>
        </div>
        <p>
          Once you have received the Ambassador tag, you will be able to set and
          track invitation goals on the Invites page.
        </p>
        <div className="flex flex-col items-center justify-center gap-y-2">
          <div className={imageFrameClassName}>
            <img
              src={ambassadorInvitationGoal}
              alt="Ambassador invitation goal dashboard showing successful invitation progress"
              className={imageClassName}
            />
          </div>
          <p className={imageCaptionClassName}>
            Ambassadors can set and track monthly invitation goals.
          </p>
        </div>

        <h2 id="resume-linkedin" className={headingClassName}>
          Resume & LinkedIn
        </h2>
        <p>
          Bringing in new members is a difficult and impressive volunteer task
          that you may want to include on your resume or LinkedIn.
        </p>
        <p>Here is an example description:</p>
        <blockquote className={quoteClassName}>
          <p>
            Successfully invited 54 new volunteer members, who each contribute
            15 minutes every week to the organization.
          </p>
        </blockquote>
        <p>
          If you would like to add your contributions under Volunteer Experience
          on LinkedIn, here is our LinkedIn page:{" "}
          <a
            href="https://www.linkedin.com/company/alliancefoundation/"
            className="text-link"
          >
            https://www.linkedin.com/company/alliancefoundation/
          </a>
          .
        </p>
      </section>
    </InfoSubpage>
  );
};

export default AmbassadorsPage;
