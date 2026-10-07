---
user: Alex Dorey
task: Stop the task form skipping members forward to a later page
---

A member navigating the task form for action 162 ("Invite a company to join a food waste pact") was skipped forward to page 5. Their stored form state had empty answers and `currentPageIndex: 4`, where they expected page 0.

The user asked for a test user in the local database matching that member (user 1849) so the bug could be reproduced locally, then, after the agent reproduced it and proposed making page navigation wait for the inputs page visibility depends on, said: "yes, write the failing tests then fix it".
