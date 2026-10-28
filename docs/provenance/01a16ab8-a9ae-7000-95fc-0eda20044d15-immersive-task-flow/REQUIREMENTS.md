---
user: chonboncode
task: Immersive full-screen, multi-step task flow on mobile and web, mapped from the existing task form JSON
---

## User-origin requirements

- Build a new task experience based on the Food Pact designs in `designs/` beside this file. It replaces the existing inline task form.
- Build it in the mobile app first.
- On an existing task, tapping "Begin" opens an immersive full-screen flow like the designs.
- The flow is driven by mapping elements of the existing task form JSON onto the new screens.
- Admin-side task creation changes as little as possible.
- Screens follow this structure:
  1. Project written text, across multiple screens.
  2. Task form inputs, across multiple screens, with at most 2 inputs per screen.
- The goal is a more engaging, digestible experience: text and inputs are broken up across separate screens.
- From the designs:
  - content screens with an X close button, a large title, body, Back/Next buttons, and a bottom progress bar
  - Next is disabled until the screen's required inputs are filled
  - a green "Task complete!" screen with the member's response card and "Close task"

- The "Task complete!" screen's second button is "Invite a friend", opening the invites page, in place of the design's "Explore upcoming projects".
- "Begin" opens a "Project background" page (that is its H1), not a summary page. It shows the contributors, then the form's opening videos and images, then its opening text, with Next and the progress bar. It does not repeat what the action page already shows: no task title, description, tags, time pills or participant progress bar. A task with no opening content skips this page.
- There is no task outline.
- There is no page-title label above the screen title ("Page 1", "Page 2", …).
- Every screen has an H1 that says, in active terms, what the member should do.
- Each scenario's description sits in an accordion that can be collapsed and is collapsed by default. This applies to every scenario.

- Current scope is the multi-step flow only. Task outline, project timeline, project background as data, and migrating past tasks come later. The approach is to restructure an existing task's JSON locally and build the flow around it.
- The reference task is action 139, "Review chatbot transcripts" (form 118 and A/B variants 120–124).

- The flow's progress bar animates smoothly between steps.
- The "Task complete" page's subheader is exactly "We'll share a progress update on this project with all members in the coming weeks." There is no thank-you sentence before it.
- The "Task complete" page stays up until the member presses "Close task" or "Invite a friend". It never closes on its own.
- Exiting a task partway and tapping "Begin" again returns the member to the screen they left.

- Following a link out of the flow to another app page (such as the forum) closes the flow popup automatically. There is no "Return to task" button on any platform.

- While an accordion section is open in the flow, its title bar stays pinned to the top as the member scrolls through it, so they can close it from anywhere in the section.

- The web app gets the same flow, built after mobile and matching its behaviour: the background page, screens, completion card, resume, pinned accordion titles and the animated progress bar.
- On web, opening the flow is a transition, not an overlay. The side nav animates down to its icons only. The top bar's search and notifications icons disappear; the profile button stays. The Alliance logo stays in the upper left, and no stroke line crosses it. The grey top band gets a stroke matching the collapsed nav. The flow reaches the right edge of the window, with no strip beside its scrollbar. The task's container (on the homepage, the task card) expands to fill the screen beside the collapsed nav.
- On web, the whole window is green while the "Task complete!" screen shows: the collapsed nav and the top band as well as the flow.
- On web, "Close task" on the "Task complete!" screen plays smoothly and quickly, in this order: the screen, nav and top band return to their default colours; the panel collapses into the task's container; the nav, top bar and everything else return to normal.
- On web, every animation in the flow uses an ease-out-quart curve over 200ms, except the panel opening out of the task's container, which uses ease-out-quart over 350ms.
- The flow's close (✕) and withdraw (…) buttons are filled light grey circles on web, as they are on mobile, and line up with the screen's text.
- The flow meets professional design standards and is consistent with itself. Buttons share one treatment: none has a stroke where its neighbours don't.
- The mobile and web flows are aligned with each other in style (text, buttons, animation and the rest), in copy and in how they're built.

## Agent-proposed, user-approved

- New content is expressed with existing form blocks only. The form schema is not changed.
- The "Task complete" card shows the member's own output answers, including any they chose to hide from other members.

- Project written-text screens come from display blocks in the form JSON (header, text, images, copytext, …). They do not come from the action's body markdown.
- A new screen starts at each form page boundary and at each `header` block, in addition to the 2-input cap.
- On mobile, the flow is behind a dev-only env flag. With the flag off, the existing inline form is unchanged.
- Time appears only as the action's total time estimate.
- No server, database schema, or admin builder changes.

- On web, the flow is behind a `TaskFlow` feature flag: on in development and staging, off in production.
- On web, flow content sits in a centred column about 640px wide, with Back/Next and the progress bar pinned to the bottom.
