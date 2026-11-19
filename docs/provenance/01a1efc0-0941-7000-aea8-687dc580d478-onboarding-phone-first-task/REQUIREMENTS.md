---
user: chonboncode
task: Ask for the member's phone number after the membership agreement in signup onboarding, and cut the platform walkthrough down to the tasks page, highlighting the first task and telling the member to get started.
---

# Requirements

## Phone step

These carry forward the phone step tabled in `docs/provenance/01a1d17d-ac6e-7000-bf2f-5173bdd6d227-onboarding-profile-mapping/REQUIREMENTS.md`, and supersede its entry that let a member who turns texts off continue with email alone.

- The signup onboarding flow gains a step after the membership agreement step where the member enters their phone number, before they reach the platform. (user-originated)
- The phone number is required: the step has no "Email only" option, and "Get started" can't be pressed until a phone number is entered; a partly typed number does not count. Its buttons are the normal Back button and "Get started". (user-originated)
- The phone step is a step of its own in the progress bar. (user-originated)
- The step is headed "Add your phone number", with the note "We’ll send you a message when a new task is assigned." It has no icon. (user-originated)
- Purpose: make sure members are notified about task assignments, since most churn is members who join and never do a task in their first 3 weeks. (user-originated)

## Walkthrough

- Most of the platform walkthrough is removed. On entering the platform the member goes straight to the tasks page, which highlights their first task and tells them to get started. (user-originated)
- The tour box has no button, only its heading and text. The member can press the task's own "Begin" while the box is showing. (user-originated)
