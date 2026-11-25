---
user: Charles Lien
task: Implement Linear issue ALL-2188, change 17 of the variable framework spec: in the old form system, refuse a submission when a visibility check throws. Keep it a narrow fix; add a test that fails before the fix.
---

# Requirements

- In the old form system, a visibility check that errors while the server validates a form submission rejects the whole submission, instead of being treated as "not shown" and stripping the answers it gates. (approved (agent research) in `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec/REQUIREMENTS.md`, the "When an input fails to load" and "In the old system" entries; scoped to this change by the user)
- The fix stays narrow to the old system's submit path, with a test that fails before it. (user)
- A throwing or missing validator refuses the submission even when what it gates is already hidden by another condition, such as a page whose own condition fails. (agent-proposed, user-approved)
- A stored form whose schema still holds an unsaved placeholder validator, one with an id below 0, refuses a submission like any other missing validator, instead of counting that validator as failed. The admin visibility preview is not a submission and keeps skipping unsaved validators. (agent-proposed, user-approved)
