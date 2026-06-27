import React from "react";
import { Link } from "react-router";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import InfoSubpage from "../../components/InfoSubpage";
import { TocSection } from "../../components/TableOfContents";

const AmbassadorProgramPage: React.FC = () => {
  useWhiteBackground();

  const tocSections: TocSection[] = [
    { id: "about", label: "About", level: 1 },
    { id: "role", label: "Role", level: 2 },
    { id: "who-to-invite", label: "Who to invite", level: 2 },
    { id: "how-to-invite", label: "How to invite", level: 2 },
    { id: "example-invites", label: "Example invites", level: 3 },
    { id: "tailoring", label: "Tailoring your invite", level: 3 },
    { id: "talking-points", label: "Talking points", level: 2 },
    { id: "invite-tools", label: "Invite tools", level: 2 },
  ];

  return (
    <InfoSubpage tocSections={tocSections}>
      <section className="gap-y-4 flex flex-col">
        <h1 id="about" className="text-title-large mb-2">
          Ambassador Program
        </h1>
        <p>
          The Ambassador Program helps the Alliance recruit reliable members.
          Our goal is to reach 1,000 members by October of 2026, which will
          enable more effective actions.
        </p>
        <p>
          This program is experimental. We are testing whether members can
          recruit new reliable members at a meaningful rate, what kinds of
          invitations work, and what support ambassadors need.
        </p>
        <p>
          To join, email Grant at{" "}
          <a href="mailto:grant@worldalliance.org" className="text-link">
            grant@worldalliance.org
          </a>
          .
        </p>

        <h2 id="role" className="mt-2 text-title-medium text-black">
          Role
        </h2>
        <p>
          Ambassadors are responsible for recruiting reliable members to the
          Alliance and sharing their learnings. Currently, we ask Ambassadors
          to:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Set a monthly goal for successful recruits.</li>
          <li>Try their best to reach their monthly recruitment goal.</li>
          <li>Share learnings in the Alliance Slack.</li>
          <li>
            Join a monthly, under 30 minute check-in call with an Alliance staff
            member.
          </li>
        </ul>
        <p>
          Most ambassadors should start with a goal of around{" "}
          <span className="font-semibold">5 successful recruits per month</span>
          . 10+ per month would be extraordinary. On average, for every 5
          invites sent, 1 yields a successful recruit.
        </p>
        <p>
          A successful recruit is someone who makes an Alliance account, signs
          their membership contract, and completes their first weekly action.
        </p>

        <h2 id="who-to-invite" className="mt-2 text-title-medium text-black">
          Who to invite
        </h2>
        <p>
          You can invite anyone who you think would be a reliable Alliance
          member.
        </p>
        <p>
          Do not only invite people who are obviously activist, political, or
          altruistic. While they are valuable, many of our most dependable
          members do not explicitly participate in these spaces. Anyone who can
          plausibly spend 15 minutes a week completing useful tasks is worth
          inviting.
        </p>
        <p>Good candidates include:</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Friends</li>
          <li>Family</li>
          <li>Classmates, present and former</li>
          <li>Coworkers, present and former</li>
          <li>Club members</li>
        </ul>
        <p>
          Start with your personal network. Invite broadly, then focus more
          attention on people who respond or seem interested.
        </p>
        <p>
          If you have exhausted your personal network, you can move to public
          outreach. Options include:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Inviting people from your favorite local coffee shop.</li>
          <li>Presenting to a club, class, house, dorm, or student group.</li>
          <li>Tabling on campus or in a public area.</li>
          <li>Attending or hosting a local event.</li>
        </ul>
        <p>
          The Alliance is happy to fund reasonable in-person recruitment
          efforts. If food, space, printing, tabling materials, or other costs
          would help you recruit, please ask staff before spending money.
        </p>
        <p>
          Recruitment is partly a volume game. Many people will not respond.
          Some will respond but not join. Some will join but not finish
          onboarding. This is normal, so invite broadly.
        </p>

        <h2 id="how-to-invite" className="mt-2 text-title-medium text-black">
          How to invite people
        </h2>
        <h3 id="example-invites" className="text-title-small text-black mt-2">
          Example invites
        </h3>
        <p>Invites work best when they are specific to the person.</p>
        <p>It is usually good to explain:</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Why you thought of them.</li>
          <li>What the Alliance is.</li>
          <li>How to join.</li>
        </ul>
        <p>
          Many members have joined after being sent a casual invite from a
          trusted friend. For example:
        </p>
        <blockquote className="border-l-4 border-zinc-200 pl-4 text-zinc-700">
          Do you want to join an online community I am part of that does small
          tasks to help the world? I thought of you because you seem like
          someone who would actually follow through on it. Alice and Bob are
          also members. You can join here: [link]
        </blockquote>
        <p>
          Some invites should include more information about the Alliance. For
          example:
        </p>
        <blockquote className="border-l-4 border-zinc-200 pl-4 text-zinc-700 space-y-3">
          <p>
            Hi Alice! I am reaching out because I know you are worried about the
            state of the world, and I think you might be interested in something
            I joined recently.
          </p>
          <p>
            I am part of an online group called the Alliance:{" "}
            <a href="https://worldalliance.org/" className="text-link">
              https://worldalliance.org/
            </a>
            . Members commit up to 15 minutes a week to coordinated actions
            that improve the world.
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
            I joined because I wanted a concrete way to help without having to
            figure out every action myself. I think you would be a good fit.
            Here is an invite link, if you are interested: [link]
          </p>
        </blockquote>

        <h3 id="tailoring" className="text-title-small text-black mt-2">
          Tailoring your invite
        </h3>
        <p>
          You know the person you are inviting best. Use that judgment to decide
          which parts of the Alliance to emphasize.
        </p>
        <p>
          Some people love how easy it is to participate: actions take up to 15
          minutes a week and usually come with clear step-by-step instructions.
        </p>
        <p>
          Others are excited by the long-term potential: if the Alliance grows,
          a reliable base of members could become a serious force for good.
        </p>
        <p>
          People also may respond most to the expert guidance, the chance to
          join early, or the fact that they can participate with people they
          already know.
        </p>

        <h2 id="talking-points" className="mt-2 text-title-medium text-black">
          Talking points
        </h2>
        <h3 className="text-title-small text-black mt-2">Actions</h3>
        <p>
          It is still early, and our actions are primarily experimental. In the
          past, we have:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
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
        <h3 className="text-title-small text-black mt-2">
          Reliability and contract
        </h3>
        <p>
          People may ask why there is a consistent commitment and why there is a
          contract. The main points to emphasize:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Reliability is what lets the Alliance plan actions precisely.</li>
          <li>It also lets members know they can count on each other.</li>
          <li>The contract is the mechanism that makes reliability real.</li>
          <li>The commitment is capped at 15 minutes per week.</li>
          <li>Members can suspend their contract at any time.</li>
          <li>
            Members can set themselves away for emergencies, travel, vacation,
            or other conflicts.
          </li>
          <li>
            Members can opt out of actions they believe are immoral or that take
            longer than 15 minutes.
          </li>
        </ul>
        <h3 className="text-title-small text-black mt-2">Experts</h3>
        <p>
          Some people find it reassuring to hear that the Alliance is supported
          by experts who occasionally lend time, knowledge, or resources.
        </p>
        <p>A few public members of the expert group include:</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>
            Janos Pasztor, former UN Assistant Secretary-General for Climate
            Change.
          </li>
          <li>
            Denis Hayes, founding coordinator of Earth Day and Chair and CEO of
            the Bullitt Foundation.
          </li>
          <li>Tara Chklovski, Founder and CEO of Technovation.</li>
          <li>
            Romina Picolotti, President, Center for Human Rights and
            Environment; former Argentine Secretary of the Environment.
          </li>
          <li>Beth Barnes, Founder and CEO of METR.</li>
          <li>Brice Lalonde, Former French Minister of the Environment.</li>
          <li>Kim Stanley Robinson, science fiction writer.</li>
          <li>
            Durwood Zaelke, President, Institute for Governance and Sustainable
            Development.
          </li>
        </ul>
        <p>
          Ambassadors do not need to list every expert. The main point is that
          the Alliance is not asking members to figure everything out alone. The
          office can draw on people with experience in climate, poverty,
          technology, policy, governance, privacy, media, and other relevant
          fields.
        </p>
        <p>
          Full list:{" "}
          <Link to="/people#expert-group" className="text-link">
            worldalliance.org/people#expert-group
          </Link>
        </p>
        <h3 className="text-title-small text-black mt-2">Roadmap</h3>
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

        <h2 id="invite-tools" className="mt-2 text-title-medium text-black">
          Invite tools
        </h2>
        <p>To be added soon.</p>
      </section>
    </InfoSubpage>
  );
};

export default AmbassadorProgramPage;
