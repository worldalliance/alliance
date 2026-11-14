---
user: Alex Dorey
task: Start implementing the Kora review section spec, beginning with the Kora project status
---

This task is the first PR of the plan in `docs/provenance/01a1c67a-0156-7000-a694-8fc78b1dd41b-kora-review-section-spec`, which lives on the `kora-personas` branch. It implements that spec's project status (R3). Batch upload, the review section, notifications and the member action come in later PRs.

- The first PR is the Kora project status: Pending, Active or Closed, stored on the server, set in the admin panel, with the project page reacting to it. The rest waits, because KORA's npm package doesn't exist yet. (agent-proposed, user-approved)
- The work builds on the Kora participants admin page, which has merged to `main` (#940). (agent-proposed, user-approved)
- The status control goes at the top of the existing Kora participants admin page, `/kora-participants`. (user-chose from agent options)
- Priya can move the project between any of the three statuses (from the spec, R3). Active is disabled until transcripts are uploaded. Batch upload isn't built yet, so in this PR Active can't be chosen at all, and the server refuses it. (user-chose from agent options)
- When the project is Closed, everyone, signed in or not, sees a thank-you and "The project has closed. Thank you to everyone who took part." in place of the sign-up form and the waitlist note. Signed-in participants keep their sign-out control. (agent-proposed, user-approved)
- While the project is Active, the project page looks the same as when it's Pending. The review section PR decides what Active shows. (agent-proposed, user-approved)
