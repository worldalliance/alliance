import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";

import { Link, href } from "react-router";

import InfoSubpage from "../../components/InfoSubpage";
import MemberContract from "../../components/MemberContract";
import { TocSection } from "../../components/TableOfContents";

const TerminologyPage: React.FC = () => {
  useWhiteBackground();

  const tocSections: TocSection[] = [
    { id: "membership", label: "Membership", level: 1 },
    { id: "member-roles", label: "Roles", level: 2 },
    { id: "actions", label: "Actions", level: 1 },
    { id: "task-assignment", label: "Task assignment", level: 2 },
    { id: "away-periods", label: "Away periods", level: 2 },
    { id: "task-scheduling", label: "Task scheduling", level: 2 },
    {
      id: "task-completion-fraction",
      label: "Task completion fraction",
      level: 2,
    },
  ];

  return (
    <InfoSubpage tocSections={tocSections}>
      <h1 className="text-title-large">Terminology</h1>
      <section className="gap-y-4 flex flex-col">
        <h2 id="membership" className="text-title-medium">
          Membership
        </h2>
        <p>
          A <span className="font-semibold">member</span> of the Alliance is
          someone who has signed and abides by a
          <span className="font-semibold"> membership contract</span>.
        </p>
        <div className="my-4 flex flex-col gap-y-4">
          <MemberContract id="contract" className="bg-zinc-50 text-base" />
          <p className="text-center text-zinc-500 text-sm">
            Our current membership contract
          </p>
        </div>
        <p>
          Members can suspend their contract at any time on their{" "}
          <Link to={href("/contract")} className="text-link hover:underline">
            contract page
          </Link>
          . If a member misses all assigned non-optional actions for 3 weeks in
          a row, their contract is automatically suspended.
        </p>

        <p>
          Members who suspend their contract will be automatically removed from
          any groups they are in and withdrawn from their active tasks.
        </p>
        <p>
          Former members can re-sign the member contract to re-join the
          Alliance.
        </p>

        <h3 id="member-roles" className="text-title-small">
          Roles
        </h3>
        <p>
          On the online platform, some people have tags that show particular
          roles they take on in the Alliance.
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            The <span className="font-semibold">Staff</span> tag is applied to
            members of the office.
          </li>
          <li>
            The <span className="font-semibold">Lead</span> tag is applied to
            members that lead accountability groups.
          </li>
          <li>
            The <span className="font-semibold">Observer</span> tag is applied
            to people who have created a profile, but have not signed the
            membership contract.
          </li>
        </ul>
      </section>

      <section className="gap-y-4 flex flex-col">
        <h2 id="actions" className="text-title-medium">
          Actions
        </h2>
        <p>
          An <span className="font-semibold">action</span> is an effort of the
          Alliance to achieve a goal, including both office activity and member
          action.
        </p>
        <p>
          A <span className="font-semibold">task</span> is a component of an
          action that requires member participation. Actions can contain
          multiple tasks, but usually only contain one.
        </p>

        <p>
          Actions go through multiple{" "}
          <span className="font-semibold">stages</span>. The most common stages
          are:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>Members taking action: when members are completing tasks.</li>
          <li>
            Office taking action: when the office is following up on an action
            by taking additional steps.
          </li>
          <li>Completed: when all parts of an action is complete.</li>
        </ul>

        <p>
          The <span className="font-semibold">authors</span> of an action are
          the members (usually, but not always, staff members) that developed
          the action. The authors of an action are displayed in a fixed random
          order on the action’s detail page (
          <Link
            to={"https://worldalliance.org/actions/75"}
            className="text-link hover:underline"
          >
            example
          </Link>
          ).
        </p>

        <h3 id="task-assignment" className="text-title-small">
          Task assignment
        </h3>
        <p>
          Members are currently assigned up to 15 minutes of tasks each week.
        </p>

        <p>
          The office sometimes assigns different tasks to different members.
          This can happen for several reasons. For example:
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>
            A task might only make sense for new members of the Alliance, such
            as a task that helps them catch up on previous actions.
          </li>
          <li>
            A task might have required a preparatory task that not all members
            completed, such as a task to make a public comment that required
            preparatory research.
          </li>
          <li>
            A task might be specialized for particular cohorts of members, such
            as members who live in a specific area.
          </li>
        </ul>
        <h3 id="away-periods" className="text-title-small">
          Away periods
        </h3>
        <p>
          An <span className="font-semibold">away period</span> is a period of
          time when a member is not available to complete tasks. Members can
          mark themselves as away in{" "}
          <Link to={href("/settings")} className="text-link hover:underline">
            settings
          </Link>
          .
        </p>
        <p>
          Members who have marked themselves as away will not be assigned a task
          if their away period overlaps the task&apos;s completion period.
        </p>
        <h3 id="task-scheduling" className="text-title-small">
          Task scheduling
        </h3>
        <p>Tasks are not launched on a consistent day of the week.</p>

        <p>
          However, a member can fulfill their commitment by spending 15 minutes
          completing tasks at any time during a calendar week. For each
          15-minute block of tasks, there is a contiguous 7-day period in which
          it can be completed that does not overlap with any other block’s 7-day
          period.
        </p>

        <h3 id="task-completion-fraction" className="text-title-small">
          Task completion fraction
        </h3>
        <p>
          Each task is associated with a fraction that measures how many members
          have completed the task out of the total number of members expected to
          complete the task.
        </p>

        <p>
          The numerator of this fraction is always the number of members that
          have completed the task.
        </p>

        <p>
          The denominator of this fraction is calculated as the number of
          members assigned the task,
        </p>
        <ul className="list-disc list-inside pl-4 space-y-2">
          <li>Minus any members that withdrew from the task.</li>
          <li>
            Plus any members that completed the task that were not assigned the
            task.
          </li>
        </ul>
      </section>
    </InfoSubpage>
  );
};

export default TerminologyPage;
