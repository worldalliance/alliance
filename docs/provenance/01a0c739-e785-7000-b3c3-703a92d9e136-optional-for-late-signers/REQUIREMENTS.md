---
user: Charles Lien
task: Assign an in-progress action to a member who signed their contract mid-window, as optional
---

# Requirements

- Recalled adding a feature where new signers were assigned the in-progress actions optionally.
- It does not appear to work on staging: a newly created account did not see that week's action on
  the home page.

## Follow-up

Agent reported that the behaviour is unimplemented on `main`, that only the wire format and client
copy for it shipped (PR #171), and that a working implementation exists on the local branch
`stable-action-assignments`, built on a saved-assignment storage model with a new table, a backfill
migration and admin controls. Agent offered two options: rebase that branch and open a PR, or write
a narrow version that widens the contract check in place with no storage model.

- Selected the narrow version: "could we pull out just the desired simple standalone part? the other
  branch is significantly more complicated."
- "Pull out" means make a copy of the changes. Do not change the `stable-action-assignments` branch.

## Review follow-up

A review (agent-authored) found that an action optional only for a mid-window signer was listed in
the uncompleted-task section of other reminders sent to them, such as an onboarding reminder.

- "users should not get reminders about their optional tasks"
