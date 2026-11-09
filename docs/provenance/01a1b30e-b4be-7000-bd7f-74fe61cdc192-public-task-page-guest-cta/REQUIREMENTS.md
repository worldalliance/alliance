---
user: chonboncode
task: Fix the public task page that non-members reach from a shared task link
---

Origins: **User** is the user's own request.

- A non-member who opens a task's page from a referral link (one carrying `?sid=` or `?ref=`) no longer sees a "Sign up" button in the panel above the task's Begin button. (User)
- On the task flow's completion screen, where a member sees "Invite a friend", that non-member sees a "Join the Alliance" button in its place, leading to signup with the referral code. (User)
- On the public task page, the expanded task flow stays below the page's fixed navigation bar: its progress bar and buttons are never covered by the bar. (User)
- The "Join us" button in the Alliance pitch a non-member sees after completing a task is a rounded rectangle, not a pill, matching the platform's other buttons. (User)
