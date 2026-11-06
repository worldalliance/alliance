---
user: Charles Lien
task: Fix ALL-1935 and ALL-1931 in one PR, both in the action store.
---

# Requirements

- A completion, withdrawal, or dismissal written while an action list or detail load is in flight does not make the store keep its older copy of that action over the load's response; the load's other fields land, with the write applied. Bring the action store in line with the notification, activity, forum post, and conversation stores, whose writes leave the record's revision alone. A regression test fails before the fix. (user-originated, ALL-1935)
- The action detail page's completion and withdrawal callbacks do not write a previous session's relation into the next session's records when the sign-in changes between the form submit and leaving the completion screen. Choose between the issue's two suggested fixes on the merits, and add the case to `shared/lib/actionSessions.test.ts`. (user-originated, ALL-1931)
