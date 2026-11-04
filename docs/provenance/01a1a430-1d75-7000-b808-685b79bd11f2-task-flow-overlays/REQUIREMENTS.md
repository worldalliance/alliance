---
user: chonboncode
task: Overlay, task card and checkbox fixes from testing the task flow on staging
---

# Requirements

- The web app's withdrawal menu, opened from the ⋯ button, opens as a popup centered in the viewport rather than anchored below the button, at every breakpoint. It shows the same options as before: "Took more than 15 minutes", "Moral objection", "On vacation", "Other reason", with the same reason box and Withdraw button. Nothing on the page, such as the profile pictures on a task card's progress bar, may cover it. (user)
- While the task flow is open, hovering the profile picture in the top bar shows the profile menu (Profile, Membership, Settings, Log out) fully visible, not covered by the task flow. (user)
- On the tasks homepage card, at narrow widths (the web app below 640px, and the mobile app), the ⋯ withdraw menu and the → details button sit above the task's title. The time estimate (for example "15 minutes") and the time left (for example "8 days left") move into that same row. The time items stay grouped together on the left edge and the two buttons stay grouped together on the right edge, spaced apart. The web card from 640px up keeps the buttons to the right of the title, with the time under it. (user)
- The task's title on the tasks homepage card is one text size smaller than before, on web at every width and in the mobile app. (user)
