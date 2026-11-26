---
user: Charles Lien
task: Greenfield redesign of the admin panel (apps/admin) so it is modern-looking and frictionless to use, built by many agents and shipped as one reviewed PR
---

## Goal and scope

- Redesign the admin panel's UI from a clean slate, as if building it from scratch today, so it is modern-looking and frictionless to use. (user-originated)
- The member-facing web app is not affected at all. (user-originated)
- No server changes. The backend stays as it is, including where the UI renames things. (agent-proposed, user-approved)
- Staff can do everything they can do today, and every function is easy to reach. Pages may be merged. (user-originated)
- Build to the final page structure in this change: decide the merged set of places, build navigation and routes to it, and redirect old URLs. (agent-proposed, user-approved)
- The content of every screen matches the content the admin has today; the prototype's screens are the look and structure, and its data is invented. (user-originated)
- Defects in today's admin that can be fixed without a backend change are fixed in this change. (user-originated)
- `/forms` gets no "New form" button: a form not attached to a task does nothing today. (user-originated)
- Showing which staff are on the same page (presence avatars) is not part of this change; it is filed as ALL-2470 in the Linear project "Modern admin". (user-originated)

## Design

- The prototype in `.scratch/greenfield/prototypes/ref/`, as revised, is the reference for the look and feel: prototype A's structure and working screens, with prototype C's sidebar, spacing and calmer surfaces. Of the first prototypes, the user prefers C's look to A's, apart from C's home page. The implementation need not follow the prototype precisely, in look or in detail; the user has not reviewed every screen of it and dislikes several things in its form builder. (user-originated)
- The admin avoids bad UI/UX in general, judged on its merits; the builder's page jumping after a click is one example, not a special rule. (user-originated, Nov 25)
- "Action updates" are called "project updates" everywhere in the admin UI, replacing the spec's "Task updates"; "General updates" is unchanged, and the server and API keep their names. (user-originated, Nov 25)
- The redesign merges before PR #1093 (the shared task panel), which then rebases its admin part onto the new builder. (user-originated, Nov 25)
- The redesign is finished this weekend (Nov 28–29), not on Monday. (user-originated, Nov 26)
- Tags are about to be retired: tag UI stays minimal, and the members list shows no Tags column. Its Role column becomes a role badge, as the frontend shows it. (user-originated, Nov 26)
- The sidebar is clean and short, with an entry at the bottom that opens the search. (user-originated)
- The sidebar's header and footer stay in place while its middle scrolls, so the button that collapses it is always visible without scrolling. (user-originated)
- The bottom search icon lines up with the other icons when the sidebar is collapsed. (user-originated)
- Density follows prototype C: prototype A's text density is too high and reads as cluttered. (user-originated)
- Home is a fixed list of queues, in this order, each shown only when its count is above zero, each with its count and one button to the queue: "Texts need a reply", "New members to welcome", "Members awaiting a group", "Partnership responses to review". With nothing waiting it is one line, "Nothing needs you right now", and the organization's stats move up. The stats sit below the queues otherwise. (agent-proposed, user-approved)
- A status is never shown by a coloured dot alone: it carries a label, such as a badge. (user-originated)
- A navigation entry such as "Forms" or "Tasks" opens a list or overview, never one arbitrary record. (user-originated)
- Light theme only, with colours defined so a dark theme can be added later. (agent-proposed, user-approved)
- The admin uses the member app's colours: the Alliance green (the member app's `--color-green`, rgb(98, 161, 36)) as the main colour and navy (its `--color-navy`, rgb(7, 30, 64), and `--site-primary`, #081e40) as the secondary, as changes to the admin's colour tokens rather than page by page. (user-originated, Nov 26)
- The form builder gets a full redesign as a three-pane workspace: outline, canvas, inspector. (agent-proposed, user-approved)

## Tasks, suites and projects

- "Action" is renamed "task" in the admin UI only. (user-originated)
- Suites and projects are easy to visualize. A suite is a group of tasks by timeline: the weekly member action and deadline are shared, and the other events are not necessarily the same. A project is a group of tasks by subject. (user-originated)
- Creating tasks and suites, and launching a suite, follows the order of today's journey, so nothing becomes visible to members in production before it is meant to. Where today's journey cannot be derived, the user is asked. (user-originated)
- Suites are created and launched in this order: a new suite takes a name only; tasks are added and built while drafts; launch is its own page with today's checks and blockers, and creates the members taking action event, the office taking action event and the default reminders only after the admin types "I am going to notify {n} real members". A draft suite says "Nothing is visible to members until you launch". (agent-proposed, user-approved)
- Tasks are always launched through a suite. Staff paste only draft tasks, with no events, and most of the time do not want events included. Editing a live task's form is normal but only for fixes, such as copy tweaks and display element updates; changing a field's id or type, or anything that would make an answer invalid, is very rare if it happens at all. (user-originated)
- Claims about how the admin is used are checked against staging data. (user-originated)

## Delivery

- One PR, with full reviews. The target is done and pushed within 12 hours if possible. (user-originated)
- The work continues until every page is rebuilt, rather than shipping a partial result at a cutoff. (agent-proposed, user-approved)
- Implementation starts only when the user says so, after rebasing onto `origin/main`. The user is handling PR #1028 themselves. (user-originated)
- Codex is out of usage: Claude runs in its place. Reviews are Claude-only, with a Codex pass before merge once its usage returns. (agent-proposed, user-approved)
- Many agents may be spawned and the work may run overnight. The machine handles roughly 50 to 100 agents at once, depending on what they run. The coordinating agent uses subagents to keep its own context small, and may spawn a monitoring subagent. (user-originated)
- The coordinating agent for the build runs on Opus 5.5. It may spawn Fable 5.2 subagents, which are more capable than it but noticeably more likely to fail with an overloaded (529) error; that failure rate is why the coordinator is not Fable. (user-originated)
- For this work the agent may commit, create worktrees, rebase onto `origin/main`, push the branch and open a draft PR without asking each time; create and edit Linear issues freely inside the "Modern admin" project; and use staging data by loading it into the local database first. It never merges the PR or pushes `production`. (user-originated)
