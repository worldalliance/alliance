# Writing a task form for the full-screen task flow

The task flow splits a task's existing form into screens. It replaces the inline task form on mobile and web. You don't need a different schema; how you arrange the blocks you already use decides what each screen looks like.

## How a form becomes screens

The rules below live in [`flowScreens.ts`](../shared/forms/flowScreens.ts) and [`useTaskFlow.ts`](../shared/forms/useTaskFlow.ts), the contributor labels in `taskFlowContributors` in [`actionTaskPanel.ts`](../shared/lib/actionTaskPanel.ts), the completion card's output view in `resolveOutputView` in [`output-resolution.ts`](../common/src/forms/output-resolution.ts), and the titles and labels in `taskFlow` and `taskFlowFallbackTitle` in [`copy.ts`](../shared/lib/copy.ts).

- **The first screen the member sees becomes the "Project background" page when it asks for nothing.** That's normally the form's opening content, up to the next header or page break; a header at the very top belongs to it. A visibility rule that hides the opening content hands this role to the next visible screen. If it holds only content (text, video, images), "Begin" opens a page titled "Project background": the contributors (authors as "Staff", reviewers as "Expert"), then that content's videos and images, then its text. A question a visibility rule hides from the member doesn't count, and the page gives way to that screen if the question shows. If it holds a question the member can see, there's no background page, and "Begin" opens that screen with its opening text and questions together. Put a header or page break after the opening content to give it its own page.
- **Each header starts a new screen, and its text is that screen's title.** Any level works. Write it in active voice, saying what the member does: "Read scenario 1: …", "Rate how the chatbot responded".
- **A screen holds at most two questions.** A third question starts a new screen with the same title. Text placed between the second and third question moves with the third.
- **A page break also starts a new screen.** The page title isn't shown.
- **The "Task complete" card is the form's default output view**, or its first output view when none has type `default`. It shows the member's own answers, including any they hid from other members.

## Conventions

- Open every screen with a header, except opening content that asks for nothing: that becomes the background page, which already has its title, so a header at its top shows as a second one, and a header further down ends the page there. A screen without one gets a generic title ("Answer the questions below" or "Read this before you continue"). Dev builds on both platforms log a warning naming the page.
- Use a label or text block for sub-labels, never a header, because a header splits the screen. A header stacked directly under a screen's opening header shows at its own level on that screen, so give it a lower level than the opening one to read as a subheading, and headers that end a page show at the bottom of that page's last screen.
- Put long reference material (a scenario, a template) in an accordion. Sections start collapsed. Accordions hold display blocks only, and not previous answers, user locations or other accordions: no questions, and no visibility rules inside a section.
- Make sure the output view the "Task complete" card shows covers each question marked as output. Without any output view, the "Task complete" card shows only the member's name and location, and a guest gets no card.
- Repeat any restructure on each A/B variant form; variants are separate forms.

## Not expressible yet

The flow has no task outline, project timeline or per-step time estimate yet. Leave them out of the form: the action's total time estimate, shown on the task page, is the only time a member sees. Project background is the opening content described above.
