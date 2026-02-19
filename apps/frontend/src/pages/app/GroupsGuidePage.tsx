import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import { Link, href } from "react-router";
import groupPillsExample from "../../assets/group-pills-example.png";
import { ArrowLeft } from "lucide-react";

const tocSections = [
  { id: "about", label: "About groups", level: 1 },
  { id: "leading-a-group", label: "Group leads", level: 2 },
  { id: "responsibilities", label: "Responsibilities", level: 3 },
  { id: "should-i-lead", label: "Should I lead a group?", level: 3 },
  { id: "being-a-member", label: "Group members", level: 2 },
  { id: "joining-leaving", label: "Joining and leaving groups", level: 3 },
  { id: "group-assignment", label: "Group assignment", level: 3 },
  { id: "how-to-lead", label: "How to lead", level: 1 },
  { id: "lead-recommendations", label: "Recommendations", level: 2 },
  { id: "lead-recommendations-1", label: "Sending reminders", level: 3 },
  { id: "lead-recommendations-2", label: "Checking in", level: 3 },
] as const;

const GroupsGuidePage: React.FC = () => {
  useWhiteBackground();

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 sm:py-10 md:py-16">
      <div className="flex md:gap-8 lg:gap-12">
        <nav
          aria-label="Table of contents"
          className="hidden lg:block shrink-0 w-52"
        >
          <div className="sticky top-12 flex flex-col gap-1">
            {tocSections.map(({ id, label, level }) => (
              <a
                key={id}
                href={`#${id}`}
                className={
                  level === 1
                    ? "pt-2 pb-0.5 font-semibold text-zinc-900 hover:text-black first:pt-0 text-xl"
                    : level === 2
                    ? "py-1 text-zinc-500 hover:text-black text-base"
                    : "pl-4 py-0.5 text-zinc-500 hover:text-zinc-900 text-base"
                }
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
        <div className="min-w-0 flex-1 max-w-3xl flex flex-col">
          <Link
            to={href("/groups")}
            className="text-link hover:underline mb-8 text-base md:text-lg"
          >
            <span className="flex flex-row items-center gap-x-2">
              <ArrowLeft size={14} /> Back to Groups
            </span>
          </Link>
          <div className="flex flex-col gap-y-12 text-base md:text-lg text-zinc-900 pb-24 md:pb-72">
            <section className="gap-y-4 flex flex-col">
              <p
                id="about"
                className="font-serif text-3xl md:text-4xl font-semibold mb-4 text-black"
              >
                About groups
              </p>
              <p>
                The Alliance is organized into{" "}
                <span className="font-semibold">accountability groups</span>.
              </p>
              <p>
                <span className="font-semibold">Group leads</span> are
                responsible for ensuring{" "}
                <span className="font-semibold">group members</span> complete
                their tasks on time. Group members are accountable to their
                lead.
              </p>
              <p>
                Accountability groups are intended to help the Alliance build a
                culture of trust and reliability, as well as to provide support
                to members.
              </p>
              <div className="flex flex-col items-center justify-center gap-y-2">
                <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-zinc-50 rounded">
                  <img
                    src={groupPillsExample}
                    alt="Group pills example"
                    className="w-full h-auto border border-zinc-200 rounded"
                  />
                </div>
                <p className="text-zinc-500 text-sm text-center">
                  Group leads can easily view the progress of their group
                  members.
                </p>
              </div>

              <h2
                id="leading-a-group"
                className="mt-2 text-2xl font-semibold text-black"
              >
                Group leads
              </h2>
              <h3
                id="responsibilities"
                className="text-xl font-semibold text-black mt-2"
              >
                Responsibilities
              </h3>
              <p>
                The main responsibility of a group lead is to ensure the members
                of their group complete their tasks on time.
              </p>
              <p>
                Group leads also serve as informal guides to the Alliance for
                their group members. For example, they sometimes clarify tasks
                or tell members about features on the platform.
              </p>
              <p>
                Any member of the Alliance can create and lead an accountability
                group. Group leads can, but are not expected to, be members of
                another accountability group.
              </p>
              <h3
                id="should-i-lead"
                className="text-xl font-semibold mt-2 text-black"
              >
                Should I lead a group?
              </h3>

              <p>There are two main reasons to lead a group:</p>
              <ol className="list-decimal list-inside pl-4 space-y-1">
                <li>
                  <span className="font-semibold">
                    You want to invite new members.
                  </span>{" "}
                  In this case, your group can be temporary: once your members
                  become familiar with the Alliance, they can transfer to other
                  groups or start their own.
                </li>
                <li>
                  <span className="font-semibold">
                    You want to help the Alliance.
                  </span>{" "}
                  In this case, you can start a long-term group that anyone can
                  join.
                </li>
              </ol>
              <p>
                Running a small, temporary group is a good way to learn whether
                you are interested in running a larger, long-term group.
              </p>
              <p>
                Current group leads report spending{" "}
                <span className="font-semibold">5–30 minutes</span> running
                their groups per week.
              </p>
              <h2
                id="being-a-member"
                className="mt-2 text-2xl font-semibold text-black"
              >
                Group members
              </h2>

              <p>
                You can only be a member of one accountability group. Being a
                member of an accountability group is strongly encouraged, but
                not required.
              </p>
              <h3
                id="joining-leaving"
                className="text-xl font-semibold mt-2 text-black"
              >
                Joining and leaving groups
              </h3>

              <p>
                When a new member joins the Alliance, they are placed in an
                accountability group. The inviting member may either add them to
                their own group or request that they be assigned to another
                group.
              </p>

              <p>
                At any time (
                <Link
                  to={href("/groups")}
                  className="text-link hover:underline"
                >
                  Groups
                </Link>{" "}
                &gt; My groups &gt; Manage groups ), you can:
              </p>
              <ol className="list-decimal list-inside pl-4 space-y-1">
                <li>Leave your current group.</li>
                <li>Join a public group.</li>
                <li>Request to be assigned to different group.</li>
              </ol>

              <h3
                id="group-assignment"
                className="text-xl font-semibold mt-2 text-black"
              >
                Group assignment
              </h3>
              <p>
                A semi-automatic assignment process runs when a group member
                asks to be reassigned, or a new member joins the Alliance and
                the inviting member does not lead a group.
              </p>
              <p>
                In most cases, a staff member will manually assign the member to
                a group with available space. This may take 3-5 days. If there
                are no groups with available space, then the member will not be
                assigned to a group until space becomes available.
              </p>
              <p>
                If a new member joins the Alliance and the inviting member does
                not lead a group, we will first check whether there is space in
                the inviting member’s lead’s group.
              </p>
            </section>

            <section className="gap-y-4 flex flex-col">
              <p
                id="how-to-lead"
                className="font-serif text-3xl md:text-4xl font-semibold mb-4 text-black"
              >
                How to lead
              </p>
              <p>
                As a group lead, you are responsible for ensuring that your
                group members complete their tasks on time. You can do this
                however you see fit.
              </p>
              <p>
                The goal is not for group members to rely on you, but to feel
                accountable to and supported by you.
              </p>
              <h2
                id="lead-recommendations"
                className="mt-2 text-2xl font-semibold text-black"
              >
                Recommendations
              </h2>
              <h3
                id="lead-recommendations-1"
                className="text-xl font-semibold mt-2 text-black"
              >
                Sending reminders
              </h3>
              <p>
                Throughout the week, check in on the Members tab (
                <Link
                  to={href("/groups")}
                  className="text-link hover:underline"
                >
                  Groups
                </Link>{" "}
                &gt; Members) to see which of your group members have completed
                their current tasks.
              </p>
              <p>
                While you can send reminders whenever it makes sense, here is a
                typical schedule:
              </p>
              <ol className="list-decimal list-inside pl-4 space-y-1">
                <li>
                  The day before the deadline, text a reminder at their
                  preferred contact time.
                </li>
                <li>
                  The day of the deadline, text or call at their preferred
                  contact time.
                </li>
                <li>
                  The day after the deadline, reach out to anyone who did not
                  complete the action and gently remind them of the importance
                  of their commitment. You can ask them if they encountered any
                  difficulties completing the action and offer to pass along
                  feedback.
                </li>
              </ol>
              <h3
                id="lead-recommendations-2"
                className="text-xl font-semibold mt-2 text-black"
              >
                Checking in
              </h3>
              <p>
                These are some extra ways you can check in on your group
                members:
              </p>
              <ol className="list-decimal list-inside pl-4 space-y-1">
                <li>
                  Engage with your group members&apos; activities (
                  <Link
                    to={href("/groups")}
                    className="text-link hover:underline"
                  >
                    Groups
                  </Link>{" "}
                  &gt; Activity).
                </li>
                <li>
                  Help any members who have difficulty completing their tasks.
                  If they have pressing questions that you cannot answer, feel
                  free to reach out to a staff member via{" "}
                  <Link
                    to={href("/messages")}
                    className="text-link hover:underline"
                  >
                    Messages
                  </Link>
                  .
                </li>
                <li>
                  Host small discussions in your group chat, available on the{" "}
                  <Link
                    to={href("/groups")}
                    className="text-link hover:underline"
                  >
                    Groups
                  </Link>{" "}
                  page and{" "}
                  <Link
                    to={href("/messages")}
                    className="text-link hover:underline"
                  >
                    Messages
                  </Link>{" "}
                  page.
                </li>
              </ol>
            </section>
          </div>
        </div>
      </div>
      <BottomSpacer />
    </div>
  );
};

export default GroupsGuidePage;
