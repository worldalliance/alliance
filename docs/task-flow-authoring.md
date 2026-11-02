# Writing a task form for the full-screen task flow

The task flow splits a task's existing form into screens. It replaces the inline task form on mobile and web. You don't need a different schema; how you arrange the blocks you already use decides what each screen looks like.

## How a form becomes screens

The rules below live in [`flowScreens.ts`](../shared/forms/flowScreens.ts) and [`useTaskFlow.ts`](../shared/forms/useTaskFlow.ts), the contributor labels in `taskFlowContributors` in [`actionTaskPanel.ts`](../shared/lib/actionTaskPanel.ts), the completion card's output view in `resolveOutputView` in [`output-resolution.ts`](../common/src/forms/output-resolution.ts), and the titles and labels in `taskFlow` and `taskFlowFallbackTitle` in [`copy.ts`](../shared/lib/copy.ts).

- **Each page is one screen.** Headers and questions never split a page; add a page break to start a new screen. The page title isn't shown.
- **The page's first header is the screen's title.** Use a level-1 header, written in active voice and saying what the member does: "Read scenario 1: …", "Rate how the chatbot responded". Any later headers on the page show in place as subheadings, and hide while every block under them, up to the next header, is hidden by its conditions.
- **The first page the member sees becomes the background page when it asks for nothing.** A visibility rule that hides the whole page hands this role to the next visible page. If it holds only content (text, video, images), "Begin" opens it, titled by its header like any step, or "Project background" without one: that page's videos and images, then its text. The contributors (authors as "Staff", reviewers as "Expert") show on the task card instead. A question a visibility rule hides from the member doesn't count, and the page gives way to a question screen if the question shows. If it holds a question the member can see, there's no background page, and "Begin" opens that screen.
- **The "Task complete" card is the form's default output view**, or its first output view when none has type `default`. It shows the member's own answers, including any they hid from other members.

## In the admin

On an action's Form tab, each page shows the step it becomes ("Background" and its title, or "Step N" and its title) and what to fix: a missing header, or more than two inputs. These notes count steps as if every page shows, and they never block saving. The action's readiness checklist also asks for an image and an output view.

## Conventions

- Open every page with a header, except an opening page that asks for nothing: that becomes the background page, which already has its title, so a header on it shows as a second one. A page without a header gets a generic title ("Answer the questions below" or "Read this before you continue"). Dev builds on both platforms log a warning naming the page.
- Keep pages short: two questions or fewer per page where you can.
- Put long reference material (a scenario, a template) in an accordion. Sections start collapsed. Accordions hold display blocks only, and not previous answers, user locations or other accordions: no questions, and no visibility rules inside a section.
- Make sure the output view the "Task complete" card shows covers each question marked as output. Without an output view that shows something, the "Task complete" screen has no card.
- Repeat any restructure on each A/B variant form; variants are separate forms.

## Not expressible yet

The flow has no task outline, project timeline or per-step time estimate yet. Leave them out of the form: the action's total time estimate, shown on the task page, is the only time a member sees. The background page is the opening content described above.
