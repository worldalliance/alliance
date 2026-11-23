---
user: chonboncode
task: Make the time picker form element's minutes go in 15-minute increments instead of every minute, and get it live on main without a PR.
---

# Requirements

Follows `01a1efbf-56c3-7000-b770-98e1ac50e663-onboarding-task-polish`, whose time picker this changes.

- The time picker form element's minute wheel offers 15-minute increments (00, 15, 30, 45) instead of every minute. (user-originated)
- Only the form builder's time picker element changes. The app's other date and time inputs, such as the shared `DateTimePicker` and the settings page's preferred reminder time, keep their per-minute steps. (user-originated)
- The change lands on `main` on its own, without the rest of the `charlie/onboardingtask` branch and without a PR. (user-originated)
