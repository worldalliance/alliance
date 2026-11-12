---
user: Charles Lien
task: Fix ALL-2113 (custom expression validators run admin-written JavaScript on the server with eval) and create a PR.
---

# Requirements

- Remove custom expression validators entirely: the `CustomExpression` validator type, both server `eval` paths (`testCustomExpression` and the `CustomExpression` case of `checkValidator`), the `POST tasks/testCustomExpression` endpoint, and the admin custom-expression editor. (ALL-2113 proposal, user-approved; "remove entirely" is user-originated.)
- Staging and production are synced, so a check against staging stands for production; no separate production check is needed. (user-originated)
