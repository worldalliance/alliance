---
user: Charles Lien
task: Implement Linear issue ALL-2189, change 18 of the variable framework spec: refuse a withdrawal after a submission on the server.
---

# Requirements

Implements change 18 of `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`, whose requirements this task inherits.

- The server refuses a withdrawal (`POST /tasks/optout/:id`) from an action the member has already submitted, matching the app, which hides withdrawal once a form is submitted. (user, from the variable framework spec's REQUIREMENTS.md)
- Keep the fix narrow and server-side, with a test that fails before it. (user)
