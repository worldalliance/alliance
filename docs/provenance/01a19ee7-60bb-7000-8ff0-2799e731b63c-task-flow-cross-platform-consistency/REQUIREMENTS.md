---
user: chonboncode
task: Fix the problems a cross-browser test of the task flow found, and bring the mobile app's look in line with the web app's
---

Origins: **User** is the user's own request. **Approved** is an agent proposal the user picked.

## Images block re-render loop (mobile)

- An images block stops re-rendering itself in a loop. On Expo web under WebKit, a task page holding an images block logged "Maximum update depth exceeded" dozens of times. (Approved)
- A test reproduces the loop's cause. (Approved)

## Mobile matches web where the two differ

Where the task flow's surfaces look different on web and mobile, mobile changes to match web. Each surface keeps its platform's container: a dropdown on web, a bottom sheet on mobile. (Approved)

### Withdraw menu

- The menu's title reads "Withdrawal options", centred. (Approved)
- Each reason carries the web's icon: a clock for "Took more than 15 minutes", scales for "Moral objection", a palm tree for "On vacation", a dashed circle for "Other reason". (Approved)
- A selected reason shows a light grey background, as on web, in place of a blue border. (Approved)
- The detail box and the Withdraw button appear once a reason is selected, as on web. (Approved)

### Home task card

- The time estimate sits under the task's title as green text with a clock, not as a filled green pill above it. (Approved)
- The details button shows a chevron, not an arrow. (Approved)
- The staff-preview notice is a rounded light blue box inside the card's padding, with a semibold heading and an eye icon, in the card's dark text colour, not a full-width blue strip. (Approved)
- The title is serif semibold at the web card's size. (Approved)
- The short description is in the dark body colour, not grey. (Approved)

### Radio buttons and checkboxes

- A selected radio button or checkbox is brand green on both web and mobile. On web this replaces the browser's default blue. (Approved: the one exception to mobile matching web)

## Native check

- The result is checked against the native iOS app in the simulator, not only the Expo web build. (Approved)
