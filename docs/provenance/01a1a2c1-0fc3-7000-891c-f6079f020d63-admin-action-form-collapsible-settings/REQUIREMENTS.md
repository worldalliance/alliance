---
user: Alex Dorey
task: Collapse rarely used action settings in the admin action form
---

# Requirements

- Rarely used settings move out of the action form's Settings section into collapsed groups by topic: Audience (Onboarding, Public Only), Completion (Optional, Complete After Deadline, Prevent Completion), Forum participation, and Custom stat. A group opens by itself when one of its fields is set. Origin: user, from the project-action-workflow task on `dorey/scratch` (commit `d6c324938`).
- Every on/off setting in the action form, including Staff Preview in Settings, shows as a switch instead of a checkbox. Origin: unknown; it came with the same commit, and no requirement for it was recorded.
- Land this on `main` as its own commit, with the message `admin-action-form-collapsible-settings`, without the rest of the project-action workflow. Origin: user.
