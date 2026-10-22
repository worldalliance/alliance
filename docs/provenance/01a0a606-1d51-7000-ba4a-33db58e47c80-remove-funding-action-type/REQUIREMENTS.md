---
user: Charles Lien
task: Delete the "Funding" action type and its unused code
---

- Remove `Funding` as an action type. Production has no actions with this type,
  and the type will not be used in the future.
- Remove the action `type` concept instead of retaining an `Activity`-only
  field. This includes the database column, API field, generated client type,
  admin control, and conditionals that only distinguish `Activity` from another
  action type.
- Delete functionality and code used only by funding actions, including the
  donation amount and unused payment flow.
- Make the migration fail loudly if any `Funding` action exists. Do not convert
  or delete an unexpected action.
- Preserve the current action import and export behavior. Add no compatibility
  handling beyond changes required by removing the fields.
