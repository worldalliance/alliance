---
user: chonboncode
task: Replace the two onboarding tasks with one task, completable in under 5 minutes, whose answers save to the member's account, with a completion screen showing the member's new profile; add new form elements for it, and a phone number step to the signup onboarding flow.
---

# Requirements

## Approach

- This change ships only the task form work: the new form elements, the mappings to the member's account, and the completion screen. It merges directly to `main` after the review loop, without a pull request. (user-originated)

- Keep everything that already exists; add new items only where necessary. (user-originated)
- The phone number is collected in the signup onboarding flow, before the member reaches the platform. Everything else, including notification preferences, is in the first task. (user-originated)

## Mapping answers to the member's account

- A form author can map the existing file upload, and the new image upload, to the member's profile photo; a textarea to the member's profile description (bio); and a checkbox, and the new toggle, to text or email notifications. The city field already maps to the member's location. (user-originated)
- Each notification mapping turns that channel on or off for the member as a whole. (agent-proposed per-channel option, user-approved and narrowed to text and email)

## New form elements

- The image upload, toggle and time picker are net-new form elements. The existing file upload, time field and checkbox stay as they are, so no existing task changes; the new elements appear only in forms built with them. They are built and working on both web and mobile. (user-originated)
- **Image upload:** a new form element, explicitly for uploading an image, that is a new visual representation of the file upload. It follows the design: a dashed rounded square holding a grey person silhouette, with "Upload photo" beneath it. (user-originated)
- **Toggle:** a new form element for yes/no or on/off inputs, so those are not only checkboxes. (user-originated)
- **Time picker:** a new, better time picker for the notification time: a custom wheel picker that looks the same on every Alliance platform, modeled for this first iteration on Apple's design rather than Material/Android's. (agent-proposed custom wheel option, user-approved with the Apple model)

## The onboarding task

- Location, bio, and photo can be answered together on one screen, using the image upload element with the existing city and textarea fields. The design's screen is titled "Last couple details...", marked "Optional", with the photo uploader, then "Location" and "Bio" fields, and Back and Complete buttons. (user-originated)
- The task offers two on/off toggles, one for text notifications and one for email notifications, both on by default, at least one of which must be on. There is no push toggle, because new members may not have the app yet. (user-originated)

## Out of scope: signup onboarding phone step (tabled, committed separately)

Kept on the `charlie/onboarding-phone-step` branch, out of this change; the entries below record what that work requires. (user-originated)

- The signup onboarding flow gains a step after the agreement step where the member enters their phone number, on web and mobile. (user-originated)
- The phone number is required only while text notifications are on; a member who turns texts off can continue with email alone. Continue stays enabled and says what is missing. (agent-proposed, user-approved)
- Purpose: make sure members are notified about task assignments, since most churn is members who join and never do a task in their first 3 weeks. (user-originated)

## Completion screen

- The completion screen shows the member's created profile: photo, name, location, and bio, as in the design in which "Task complete!" heads a green screen above a white profile card, with "Close task" and "Invite a friend" buttons. (user-originated)
- A form has a completion subtitle setting. When set, it replaces the default subtitle under "Task complete!". The onboarding task's subtitle will be "You can change any of the provided information in Settings. Welcome to the Alliance!", which the user will enter in the admin. (agent-proposed, user-approved)
