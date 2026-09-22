---
user: chonboncode
task: Tweaks to the onboarding flow, the platform walkthrough and the login screen
---

## 1. Priority cards, hover description

The description that appears on hover is too small. Its text size must match the
text size on the current homepage, because it is the same component and should
be equally legible.

Revised after a first attempt brought the homepage component's own sizing into
the flow: the boxes came out too large. Revert that. Match only the description
text size from the homepage, and keep every other container size as it was, so
the sizes settled during the onboarding design process are not disturbed.

Revised again after that: the text is now too big and leaves the box. Use the
exact middle between the size it became and the size it was before this task
started. Report that value, and where in the codebase it can be adjusted by
hand.

Revised again after being shown that opening a description pushes the card's
title up over the rule at the card's head, by 47px at 1024x768. An attempt that
widened the cards as well as growing them was reverted in full: it cut off the
sides of the screen and was called a complete failure. On the 1024x768 screen
and the screens around it, increase the height of the container so the
description fits, without disrupting the placement of any other content on the
page.

## 2. Fifteen-minutes screen

A scroll bar appears briefly when the screen first loads. It disappears on its
own, but it must never appear: there is no scrolling on this page.

## 3. Fifteen-minutes graphic

Remove "Action arrives" and "Deadline" entirely, at every breakpoint narrower
than desktop.

Change the first and last box so they are the same as all the others. This one
applies at every breakpoint.

Added after seeing it on a Galaxy tablet at 700x1138, where the grid was laid
out horizontally although the screen was vertical: the grid should follow
whether the screen is being read vertically or horizontally. Not the exact
aspect ratio. 4:5 is the parameter, meaning anything closer to square than
that, more than 80 percent one way, counts as square and takes the horizontal
grid. Another way of expressing the parameter is acceptable if it is better.

## 4. Agreement screen, desktop only

Break up the flow by reorienting the page. At wide breakpoints only (not mobile,
not tablet or iPad), the header and subheader sit side by side with the
agreement and the social proof.

- The header and subheader text is left aligned.
- A strict gap between the two halves that does not expand on very wide
  monitors.
- Not columns. One container, centre aligned on the page.

Added after seeing it: centre the header and subheader on the agreement
container, not on the agreement container and the social proof together. Widen
the header and subheader.

## 5. Walkthrough dialogue

- Replace "Skip" with a back button.
- Move Skip to where the "1 of 7" text currently sits, as a tertiary button.
- Put the progress bar animation used in the onboarding narrative flow at the
  bottom of the dialogue. Very thin, seven steps.
- Change the dialogue background to primary blue.

Added after seeing it: the Skip button is too small, increase its size.

## 6. Walkthrough step 2

Change the header from "The most important part" to "Your tasks".

The step needs a way to show that the member does not have to fill the task in
right now and will do so once the tour is complete. A coworker suggested a large
"EXAMPLE" overlay on the task; the user does not like that plan but agrees the
step is confusing and feels like it asks the member to enter their phone number
in the middle of the walkthrough.

Revised after a first attempt added two sentences to the dialogue body: solving
this with text is the wrong approach. Most people do not read the description,
so they still see an open phone number field and assume they have to do
something. Delete the added text and try again with a more visual intervention.

Revised again after seeing the result: the greying out is good, keep it. Remove
the bubble at the top reading "After the tour".

## 7. Walkthrough step 4

The subheader must not be actionable. Instead of "Click your membership", it
should explain that the profile settings and the membership sit behind the
profile icon, and lightly suggest adding a profile picture. The wording the user
gave: "...settings and your...behind the profile icon...".

Revised after seeing it: "settings", not "profile settings".

## 8. Walkthrough step 5

Change "end your agreement" to "suspend your agreement".

## 9. A phone held sideways

None of the screens are optimised for an iPhone held horizontally. This is a
major failure. Content must be dropped to make room for the most important
content.

- The white background must go. Full bleed blue, the same as it is vertically.
- Buttons shrink slightly.
- The four priorities show as 4x1.
- The platform mockups show all three at once rather than the tap, the way
  desktop does, except only the headline shows, the top part of the graphic,
  with the rest fading out under the gradient feather as it does now.
- Milestones: remove the subheader.
- Fifteen minutes: remove the subheader. The grid is correctly horizontal but
  is not filling the screen, so expand it slightly to take the full screen.
- Agreement: remove the subheader and the social proof.

## 10. Zoom on a focused field

On mobile, tapping the full-name membership input makes the phone zoom in on the
text box. Eliminate that, here and on the log in page. Failing that, make the
page zoom back out when the member finishes typing, hits enter, or the keyboard
goes away.

The agent reported that iOS Safari zooms whenever a focused field's text is
under 16px, that all three fields measure 11.7px to 13.1px, and that raising
them to 16px on touch devices removes the behaviour; also that zooming back out
cannot be done reliably from JavaScript. The user asked what the industry
standard is, having noticed that text-heavy sites do not interrupt typing this
way, and chose to proceed.

## 11. Full agreement in a popup

On the contract screen, "View full agreement" currently sends the member to
another page. Make it a popup instead, so they do not leave the page.

- The popup holds the entire /governance page as scrollable content.
- It works like a terms and conditions popup.
- The X button in the corner must be very clear.
- Keep the text small but legible, so there is not an extreme amount of
  scrolling.
- A green stroke on the popup container.

The user's manager wants the popup text to have "the same source" as the
governance page. Told that the manager already edits governance inside the
codebase, and that the contract body already comes from the database: tie the
popup to whatever is on the main governance page.

The bottom of the popup needs the gradient feather, so it is clear there is more
to scroll to.

## 12. Login and create-account screen

The graphic panel on the right side.

- Remove the "Project begins at 1,000 members" text.
- Fix its responsiveness. On shorter screens the subtext under "Join the
  Alliance to unlock $100,000 for the world" is cut off. Detect when it is cut
  off and remove the subtext entirely; when the screen gets shorter still,
  remove the "Join the Alliance..." line entirely. In that order.
- Decrease the spacing between "Join the Alliance..." and "Philanthropists..."
  by a quarter.
