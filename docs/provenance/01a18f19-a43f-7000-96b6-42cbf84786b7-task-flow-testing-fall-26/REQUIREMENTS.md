---
user: chonboncode
task: Apply the "Changes Needed" from the Fall '26 platform upgrade testing notes to the full-screen task flow
---

Each requirement has an ID, cited by the commit that implements it, and quotes the testing notes it comes from. Unless marked otherwise, a requirement applies to both web and mobile.

Origins: **Notes** is the testing notes as the user supplied them. **User** is the user's own answer. **Approved** is an agent proposal the user picked.

## TN-1: Progress bar at the top

From the notes: "Move progress bar to the top".

- The flow's progress bar sits at the top of the content column, above the row holding the close (✕) and withdraw (…) buttons, instead of under the footer. (Approved)

## TN-2: "Continue" after leaving

From the notes: "When you leave the task and come back the button should say 'continue' not 'begin'".

- The button that opens the flow reads "Continue" when the member has started the task before (a saved screen or a saved draft), and "Begin" otherwise. (Notes)

## TN-3: "Progress auto-saved"

From the notes: "Add 'progress is saved' as a small grey disclaimer".

- The flow shows "Progress auto-saved" in small grey text to the right of the close (✕) button, wherever answers save. (Notes, placement and wording: User)
- It shows only from the flow's second step on, not on its first. (User)

## TN-4: Admin indicators for the task flow (admin)

From the notes: "Need indicators on Admin side that clearly communicate how it will translate to the multi-step task view".

- The admin form builder labels each page with the step it becomes: "Step N" followed by the title that step will show, or "Project background" for the background page. (Approved)
- The form builder's issues list warns when a page has no header block, when a page has more than 2 inputs, when the form has no output view, and when the task has no image. (Approved)

## TN-5: A completed task on its action page

From the notes: "Fix how the Task is displayed on the project page" and "On completion, in project page, 'view task' button should be replaced with the completion artifact".

- On a completed task's action page, the button that opens the read-only flow ("View task") is a grey secondary button. (User)
- Below it, the task panel shows the same answers card as the "Task complete!" screen: the member's avatar, name and city above the form's output view, subject to TN-24. (User)

## TN-6: No line above Begin

From the notes: "Kill the line above 'begin' on the task preview".

- The task card on the tasks homepage has no divider line above the Begin button. (Notes)

## TN-7: Begin / Continue icon

From the notes: "'Begin' button should maybe be black in order to stand out next to the green progress bar" and "Begin / continue button should have iconology?".

- The Begin / Continue button stays green and gets a right arrow icon. (Approved)

## TN-8: Web nav borders while the flow is open (web)

From the notes: "The borders should be 'merged' – in other words, there should just be a border around the white part of the screen" and "The border color should stay the same as when the task is not opened".

- While the flow is open, the only strokes are one border around the flow's white area. No stroke runs across the collapsed side nav under the logo. (Notes)
- The strokes keep the colour the nav's border has when the flow is closed. (Notes)

## TN-9: Space above the close button (web)

From the notes: "Web: more space between X button and the top nav bar".

- There is more space between the flow's close (✕) button and the top nav bar. (Notes)

## TN-10: Back / Next / Complete

From the notes: "Back / next / submit buttons should have iconology" and "Submit -> complete ?".

- Back has a left arrow icon, Next a right arrow icon. (Approved)
- The last screen's button reads "Complete" with a check icon, in place of "Submit". (Approved)

## TN-11: Completion screen buttons

From the notes: "Close task / invite a friend buttons should have iconology", "Close is maybe a sad word?" and "'View Tasks' instead?".

- "Close task" becomes "View tasks", with a list icon. It closes the flow and goes to the tasks homepage; on the tasks homepage it only closes the flow. (Approved)
- "Invite a friend" has a person-plus icon. (Approved)

## TN-12: Contributors on the task card

From the notes: "This could be an opportunity to display the project contributors on the preview card?", "If we are going to display them on the first page, should label them explicitly as contributors + make this list look better (should be side by side on large screens, less space between title and subtitle, less space between text + photo)", "Also will look bad w/ more than like 3 ppl" and "Add contributors header".

- Contributors move from the "Project background" page to the task card, under a "Contributors" heading. (Approved)
- The list names the task's authors as well as its expert reviewers, wherever the card shows. (User)
- They sit side by side on large screens, with less space between name and role and between text and photo. (Notes)
- Side by side, they sit next to each other with a normal gap between them, not spread into columns. (User)

## TN-13: Completion card fades under the buttons

From the notes: "FIx cut off of artifact on scroll".

- Where the scrolling content of the "Task complete!" screen meets the buttons, it fades out through a gradient instead of being cut off sharply. (User)

## TN-14: Links say they open in a new tab

From the notes: "Links within task forms should probably open in a new tab (e.g. links to forum post)", "Feels jarring to be in the embedded view -> suddenly on a new tab" and "Option to say 'will open in new tab'".

- Each link in task form content shows an external-link icon after it, and announces "opens in new tab" to screen readers. (Approved)

## TN-15: Withdraw from every step

From the notes: "Three-dot button should show up on every page", "Add ability to withdraw (3 dots menu) on all steps", "Withdraw dots do not appear on 1-page tasks" and "Add 3 dots menu back to the task card on tasks homepage".

- The withdraw (…) menu is on every step of the flow, including tasks with a single page, wherever the member can withdraw. (Notes)
- The task card on the tasks homepage has the withdraw (…) menu. (Notes)
- On that card the menu sits in the upper right corner, beside the button that opens the task's page. That button shows only a right arrow, without the word "Details". Both are circular buttons. (User)

## TN-16: Mobile task card (mobile)

From the notes: "Mobile preview card should take up near-full screen", "Make it look more like a card somehow", "Maybe grey separator below it / identical to the separators between the activity cards in the feed" and "While we're at it let's kill the 'activity' heading below the preview card".

- On the mobile tasks homepage, the current task card hugs its contents, with no empty space under the contributors. (User)
- A grey separator identical to the ones between feed activity cards sits below it. (Notes)
- The "Activity" heading below it is removed. (Notes)

## TN-17: How the progress bar moves

From the notes: "Due to the way the bar works, sometimes selecting an option makes your progress go down", "2nd step should not show progress bar at completion. The state of the progress bar should not automatically assume the user is going to be [done]", "Progress bar should not change dynamically based on answer selection. It should change dynamically during page transitions" and "Progress bar going backwards decently worse than progress going forwards a lot".

- Progress is the number of steps finished divided by the number of steps. (Approved)
- It changes only when the member moves between steps, never while they answer. (Notes)
- It never goes backwards, except when the member presses Back. (Approved)
- It is never full before the member completes the task. (Approved)

## TN-18: Resizing keeps the flow open (web)

From the notes: "Changing window sizes takes me out of task completion".

- Resizing the window doesn't close the flow or lose the member's place. (Notes)

## TN-19: Invite a friend

From the notes: "Invite friend transition is takes you to tasks first, jittery", "'Invite a friend' grey button has insufficient contract with green background" and "Navy blue? Black?".

- "Invite a friend" goes straight to the invites page, without passing through the tasks page. (User)
- The button is navy blue. (User)

## TN-20: Close order (web)

From the notes: "When you 'close task', the task closes then the bar comes up. Would prefer sidebar to expand, then task to close so there is less horizontal movement".

- Every close of the flow, from the close (✕) button as well as the completion screen, widens the side nav first and then shrinks the flow into the task's container. (Notes, every close: Approved)

## TN-21: Typing on mobile (mobile)

From the notes: "On open-ended type fields a new input field appears above the keyboard (location selector)", "On others the keyboard opens and pushes the progress bar/control console up with it", "The keyboard should overlay on top of the progress field and the page should scroll to the field thats being inputted, no zoom. Have the second input field appear for all typing inputs" and "Mobile doesn't scroll down enough when selecting some fields".

- Typed inputs stay inline in the step: no second input field opens above the keyboard, except the city picker's existing one. This supersedes the note's request for a second input field. (User)
- The keyboard covers the footer (Back, Next) instead of pushing it up. (Notes)
- The screen scrolls the focused field fully into view, with no zoom. (Notes)
- Dragging the step's content down dismisses the keyboard, so the footer is reachable from a keypad with no return key. (Approved)

## TN-22: Tap the background to close the completion screen

From the notes: "Tapping anywhere should close the task (at least on mobile)".

- On the "Task complete!" screen, tapping the background closes the flow as "View tasks" does. Tapping the title, the text, the answers card (so the member can scroll it) or the buttons doesn't. (User)

## TN-23: Heading weights

From the notes: "'Task complete' should be semibold … and/or serif" and "Headings in task form should be semibold or whatever weight we currently use".

- "Task complete!" is semibold sans-serif. (Approved)
- Step titles and header blocks in the flow are semibold sans-serif. (Approved)

## TN-24: No answers card without an output view

From the notes: "Remove the artifact card on completion page if no output view".

- The "Task complete!" screen shows the answers card only when the form has an output view to show. (Notes)

## TN-25: One step per page

From the notes: "Remove mapping of page breaks via header and 3rd question, should only happen at page breaks" and "What header type should I use for each step?".

- Each form page is one step. Header blocks and a page's 3rd input no longer start a new step. (Notes)
- A step's title is its page's first header block. The page's title isn't shown. A page with no header block gets the generic fallback title. (Approved)
- Authors open each page with a level-1 header block. (Approved)
- A header block within a step hides while every block under it, up to the next header block, is hidden, and shows again with them. (User)

## TN-26: At most three faces above the task card's progress bar

- Above the task card's progress bar, at most 3 faces of friends who completed the task show, followed by "+N" for the rest, so the faces, "+N" and the "… members completed" count fit on one line. (User)

## Out of scope

- A date picker for date fields on mobile is separate work. (User)
- The "Task complete!" screen keeps its green full-screen treatment. (User)
- "Invite a friend" keeps going to the generic invites page; a task-specific invite page is separate work. (User)
