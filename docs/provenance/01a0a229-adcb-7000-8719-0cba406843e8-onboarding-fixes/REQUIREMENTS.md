---
user: chonboncode
task: Disable the mobile onboarding narrative and walkthrough; fix layout problems on the web onboarding narrative flow.
---

# Mobile

- Disable, but do not delete, every part of the new onboarding flow from its first screen (the priorities screen) through the platform walkthrough. All of them off.
- Logging in goes straight to the platform: no walkthrough, no explanation, nothing.
- The only thing left from the recent mobile changes is the new login screen, with its upgraded UI and grass background photo.
- On that login screen the picture must be stationary. When the keyboard opens (after tapping an input), the whole login component moves up with the keyboard while the picture stays still. Today the picture shrinks and expands as the keyboard opens and closes. That cannot happen.
- The photo must not be scaled up or down. Its height should match the height of the viewport.

# Web onboarding narrative flow

- The space between the header (above the graphic content) and the subheader (below the graphic content) must always be equal.
- The platform mockup examples must use a variety of profile pictures pulled from the database. Using the same four photos on all three examples is unacceptable.
- Fifteen-minutes screen: the graphic does not respond well to wide mobile breakpoints. The grid must react to the viewport width rather than keeping the same square size and making the user scroll.
- Goal for the first four screens: the user never has to scroll, they read or tap and press continue.
- If an abnormal breakpoint does force scrolling, the top row (where "What is the Alliance?" sits) gets a gradient feather so content fades out of view instead of being cut off hard. Same at the bottom, where the buttons are.
- Impact screen (the membership milestones): stack each milestone group vertically, halve the height of the progress bar, and remove the "Completed" qualifier under the first three. The user must still not have to scroll with them stacked vertically.
- Agreement page: the keyboard popup on tapping the input field makes this page poor. The input field must be visible no matter what.
- The page itself must never scroll. The content inside the agreement (for example the steps 1-4) scrolls instead. By default it is not scrollable; when the keyboard opens and viewport height shrinks, the agreement UI absorbs that rather than the page UI.
- Remove the numbers 1-4 and their bubbles.
- Decrease the vertical padding in the container holding the "sign your full name" input field.
- Make that container's background grey, like the rest of the UI. The input field itself stays white.
- Most important: every element stays independently viewable at all times, meaning the header, the subheader, the agreement UI, the input field, the faces, and the buttons.
- On a condensed viewport the membership content scrolls within the membership container, not the page. When that happens, add the gradual scroll gradient there too, so it is clear it scrolls rather than being cut off harshly.

# Process

- Be thorough, check the work across browsers and breakpoints.
