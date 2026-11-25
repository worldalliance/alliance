---
user: chonboncode
task: Polish the onboarding task's new elements after review on staging: a shorter, full-width time picker with more space under its question; notification toggles that keep at least one on; and a plain completion card with a larger profile photo.
---

# Requirements

Follows `01a1d17d-ac6e-7000-bf2f-5173bdd6d227-onboarding-profile-mapping`, whose time picker, toggle and completion card these change.

## Time picker

- More space between the question and the picker. (user-originated)
- The picker is 33% shorter than before (180px to 120px), so rows cut off sooner and it is no longer square. (user-originated)
- It is visually wider: the grey container spans the width of the form column, and the selected-row band spans the container's width, as in the design, an iOS-style wheel whose band runs nearly edge to edge with hour, minute and AM/PM columns grouped in the middle. Unselected numbers are grey and the selected row's are dark, as in the design. (user-originated)

## Notification toggles

- The text and email notification toggles show no "Optional" label above them, and the member can switch each one. (user-originated)
- Both are on by default. (user-originated)
- At least one is on at all times, dynamically: when the member turns one off while the other is already off, the other turns on, so it is clear at least one must be on. The member never has to act when the defaults suit them. (user-originated)

## Completion screen

- On the task flow's completion screen only, the card shows the member's photo, name and location, then the output view's answers as plain text: no inner grey card and no labels. In the design, the bio sits as a paragraph under the name and location. (user-originated)
- The profile photo on that card is somewhat larger. (user-originated)
- The activity views, the task page's card of a completed response, and every other place answers render keep their current design. (user-originated)
