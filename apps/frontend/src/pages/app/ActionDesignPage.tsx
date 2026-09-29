import React from "react";
import { Link, href } from "react-router";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import InfoSubpage from "../../components/InfoSubpage";
import { TocSection } from "../../components/TableOfContents";

enum Section {
  DesigningActions = "designing-actions",
  InitialIdea = "initial-idea",
  MakingAPlan = "making-a-plan",
  Preparation = "preparation",
  TaskProduction = "task-production",
  Launch = "launch",
  FollowUp = "follow-up",
  SubmitActionIdea = "submit-action-idea",
}

const SECTIONS: TocSection[] = [
  { id: Section.DesigningActions, label: "Action design", level: 1 },
  { id: Section.InitialIdea, label: "Initial idea", level: 2 },
  { id: Section.MakingAPlan, label: "Making a plan", level: 2 },
  { id: Section.Preparation, label: "Preparatory steps", level: 2 },
  { id: Section.TaskProduction, label: "Task production", level: 2 },
  { id: Section.Launch, label: "Launch", level: 2 },
  { id: Section.FollowUp, label: "Follow-up steps", level: 2 },
  { id: Section.SubmitActionIdea, label: "Submit an idea", level: 1 },
];

const TerminologyPage: React.FC = () => {
  useWhiteBackground();

  return (
    <InfoSubpage tocSections={SECTIONS}>
      <section className="gap-y-4 flex flex-col">
        <h1 id={Section.DesigningActions} className="text-title">
          Action design
        </h1>
        <p className="text-zinc-500">
          The following is a simplified version of a guide that the office
          references internally.
        </p>
        <p>
          We work hard to design high-quality actions. Running regular actions
          helps us refine our internal action production process, which we
          believe must be robust and streamlined by the time we{" "}
          <Link to={href("/roadmap")} className="text-link hover:underline">
            launch publicly.
          </Link>
        </p>

        <p>
          To make the most of our time and members’ time in this early stage, we
          mostly run actions that either:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            <span className="font-semibold">Teach us something</span>, such as
            by testing a general action strategy at a small scale.
          </li>
          <li>
            <span className="font-semibold">
              Help us accomplish a strategic goal
            </span>
            , such as by helping us grow.
          </li>
        </ul>

        <p>
          Actions can easily test multiple hypotheses and accomplish multiple
          strategic goals at once.
        </p>

        <p>These are examples of actions that tested specific hypotheses:</p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            <Link to="/actions/14" className="text-link">
              “Sign a letter requesting news coverage of a bring-your-own-cup
              cafe coalition”
            </Link>{" "}
            tested if businesses would make policy changes in exchange for
            assistance in acquiring media coverage.
          </li>
          <li>
            <Link to="/actions/32" className="text-link">
              “Answer questions about nonprofit website copy and design”
            </Link>{" "}
            tested if we could build relationships with potential future
            partners by providing small-scale help.
          </li>
          <li>
            <Link to="/actions/52" className="text-link">
              “Participate in an experiment to measure AI + follow-up friends
              and family campaign”
            </Link>{" "}
            tested if simple pilot experiments with members could kickstart
            external educational campaigns.
          </li>
        </ul>

        <p>
          These are examples of actions that helped us accomplish strategic
          goals:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            <Link to="/actions/74" className="text-link">
              “Consider inviting new members to the Alliance”
            </Link>{" "}
            helped us test a new invite process.
          </li>
          <li>
            <Link to="/actions/71" className="text-link">
              “Contribute to a discussion about Alliance culture”
            </Link>{" "}
            helped us develop community norms.
          </li>
          <li>
            <Link to="/actions/52" className="text-link">
              “Provide a quote about Alliance participation”
            </Link>{" "}
            helped us make a more compelling case to prospective external
            supporters.
          </li>
        </ul>

        <p>
          There are many additional factors that we look for in actions. For
          instance, we like actions that:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>Are likely to produce clear, positive results.</li>
          <li>
            Are creative and novel, especially by taking advantage of the
            Alliance’s unique structure.
          </li>
          <li>
            Offer direct benefits to members, such as by providing an
            educational opportunity.
          </li>
          <li>
            Set up for future actions, such as by building relationships with
            possible future partners.
          </li>
        </ul>

        <p>
          Action design is open-ended and creative, so we have no standard
          process. However, actions often go through the following stages.
        </p>

        <h2 id={Section.InitialIdea} className="mt-2 text-title-small">
          Initial idea
        </h2>

        <p>
          We often develop action plans around initial “seed” ideas, which are
          simple observations that we think could be leveraged by the Alliance.
          These initial ideas may come from research, previous knowledge, or
          random inspiration.
        </p>

        <p>For example:</p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            The initial idea behind{" "}
            <Link to="/actions/75" className="text-link">
              “Help inform public comments on U.S. federal AI policy”
            </Link>{" "}
            was that federal dockets are typically unused by regular citizens.
          </li>
          <li>
            The initial idea behind{" "}
            <Link to="/actions/71" className="text-link">
              “Participate in an experiment to measure awareness of AI data use
              practices”
            </Link>{" "}
            was that many users of AI services likely want more privacy than
            default settings provide.
          </li>
          <li>
            The initial idea behind{" "}
            <Link to="/actions/47" className="text-link">
              “Decide how to allocate $1,000 next week”
            </Link>{" "}
            was that some donors we knew were experimenting with democratic
            processes for allocating their funds.
          </li>
        </ul>

        <h2 id={Section.MakingAPlan} className="mt-2 text-title-small">
          Making a plan
        </h2>

        <p>
          Once we are sufficiently interested in an initial idea, we make a plan
          that outlines the basic steps that each party needs to take so that
          the action will achieve concrete results.
        </p>

        <p>
          As we develop this plan, we think extensively about the various
          factors that could cause the action to succeed or fail, such as:
        </p>

        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>What we believe members and the office are capable of.</li>
          <li>How long we expect different segments of the action to take.</li>
          <li>What fallbacks exist if something goes wrong.</li>
        </ul>

        <p>
          As an example, this was our basic plan for{" "}
          <Link to="/actions/75" className="text-link">
            “Help inform public comments on U.S. federal AI policy”
          </Link>
          :
        </p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
          <li>Office picks relevant federal dockets.</li>
          <li>
            Office emails relevant experts for opinions and sample questions for
            each docket.
          </li>
          <li>
            Office writes context for each docket (background info, summary, and
            expert opinions) and comes up with relevant, member-friendly
            questions.
          </li>
          <li>Members read context and answer questions.</li>
          <li>
            Office writes and integrates member responses into docket comments.
          </li>
          <li>Office submits docket comments.</li>
          <li>Office watches for and analyzes docket results.</li>
          <li>Office reports back to members on docket results.</li>
        </ol>

        <p>
          Having a basic plan makes an action more concrete and easy to think
          about. As a result, we find it useful at this stage to explore ways we
          can modify or add to the basic plan. For instance, we turned an
          initial plan to{" "}
          <Link to="/actions/52" className="text-link">
            help members adjust their privacy settings
          </Link>{" "}
          into an opportunity to recruit new members (by running a follow-up
          experiment that members sent to their friends and family) and launch a
          media campaign (by sending the experiment’s results to the media).
        </p>

        <h2 id={Section.Preparation} className="mt-2 text-title-small">
          Preparatory steps
        </h2>
        <p>
          After we are satisfied with a plan, we execute any steps that are
          necessary before members can take action. For instance, these
          sometimes require outreach, research, and small tests.
        </p>

        <h2 id={Section.TaskProduction} className="mt-2 text-title-small">
          Task production
        </h2>
        <p>
          Eventually, we are ready to help members complete their part of an
          action. We pay special attention to the experience that members will
          have when they complete the task.
        </p>

        <p>
          We want every member to have an experience that is as simple and
          straightforward as possible. This includes:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            Writing clean copy, ordering information logically, and providing
            straightforward instructions.
          </li>
          <li>
            Developing software for task-specific features. For instance, we
            developed a{" "}
            <Link to="/flyerexport" className="text-link">
              flyer generator
            </Link>{" "}
            for{" "}
            <Link to="/actions/56" className="text-link">
              “Invite friends and family to fill out our AI privacy survey”
            </Link>{" "}
            so that members could easily share our survey and track which
            respondents they brought in.
          </li>
          <li>
            Accounting for members&apos; habits. For instance, when designing a
            pothole-reporting action, we kept in mind that many members complete
            tasks at the last minute. We separated the action into a{" "}
            <Link to="/actions/48" className="text-link">
              planning task
            </Link>{" "}
            and a{" "}
            <Link to="/actions/50" className="text-link">
              reporting task
            </Link>{" "}
            so that members would not realize they needed to go outside the
            night of the deadline.
          </li>
          <li>
            Accommodating different categories of members. For instance, in{" "}
            <Link to="/actions/70" className="text-link">
              “Collect unclaimed property for a potential future donation,”
            </Link>{" "}
            we provided additional information to members who are not U.S.
            citizens. As another example, we made drop-off optional in{" "}
            <Link to="/actions/60" className="text-link">
              “Collect e-waste for proper disposal”
            </Link>{" "}
            for members who lived far away from an e-waste disposal site.
          </li>
        </ul>

        <p>
          After we have a draft of a task, we test it. We repeatedly complete
          the task ourselves to identify ambiguous instructions, clunky text,
          and other issues. We also solicit feedback from random members.
        </p>

        <h2 id={Section.Launch} className="mt-2 text-title-small">
          Launch
        </h2>
        <p>
          After we launch a task to members, we monitor the first few hours of
          member completions and fix any problems members encounter. For
          instance, our initial wording in the task for{" "}
          <Link to="/actions/49" className="text-link">
            “Approve proposals for how to spend $1,000”
          </Link>{" "}
          confused the first few members who completed it, so we revised it and
          and followed up with those members to ask if the changes affected
          their responses.
        </p>
        <p>
          We continue to monitor the task throughout the week, taking care of
          bugs, special cases, and other problems that arise. We also track the
          task&apos;s completion rate over time to ensure that we are on track
          to succeed.
        </p>

        <h2 id={Section.FollowUp} className="mt-2 text-title-small">
          Follow-up steps
        </h2>

        <p>
          Once members have completed their part of an action, we ensure that
          all remaining steps are executed by ourselves or by other parties. For
          instance, after members completed the task for{" "}
          <Link to="/actions/14" className="text-link">
            “Sign a letter requesting news coverage of a bring-your-own-cup cafe
            coalition,”
          </Link>{" "}
          we sent journalists information about the initiative so that we would
          fulfill our promise to the involved cafés. We continued sending emails
          to journalists until one of them covered the story.
        </p>

        <p>We send out updates to members as the action progresses.</p>

        <p>
          For now, members usually only participate in one step of an action. In
          the future, we imagine that more complex actions will require members
          and the office to take multiple, alternating steps.
        </p>
      </section>

      <section className="gap-y-4 flex flex-col">
        <h1 id={Section.SubmitActionIdea} className="text-title">
          Submit an action idea
        </h1>
        <p>
          If you have an idea for an action, or information that might help us
          develop an action, please email the office at{" "}
          <Link to="mailto:contact@worldalliance.org" className="text-link">
            contact@worldalliance.org
          </Link>{" "}
          or message a{" "}
          <Link to={"/members?filter=Staff"} className="text-link">
            staff member
          </Link>
          .
        </p>
      </section>
    </InfoSubpage>
  );
};

export default TerminologyPage;
