---
user: Charles Lien
task: Review the form schema from zero against established form formats, decide which edits the Variable framework Linear project needs, and record them in a provenance PR, editing the Linear issues after that PR merges.
---

# Requirements

The Variable framework spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Where an entry below changes one of its requirements, it says so.

## Scope

- This PR records the decisions. The Variable framework Linear project's issues are edited after it merges. (user-originated)

## The new form format

- The new form format that "Forms on the new language" (ALL-2184) introduces is a redesigned schema, designed in one pass while that format is created, so stored forms change shape once (ALL-2185 converts them into it). It has: (agent-proposed, user-approved)
  - each question's data type separate from its presentation (its appearance), so a new widget needs no new type;
  - one section declaring every input the form reads from outside its own answers, referred to by name wherever it is used, in place of a source form id on each condition, formula input, prefill and block;
  - writing an answer back to the member's profile declared once per item, in one shape;
  - results views, aggregate views and share text in their own section, reading answers like everything else does;
  - no deprecated `custom` field kind, no contract text copied into the schema, and no `html` block.
- The new format's stored shape is the model admins and engineers reason about; there is no separate internal model behind it. (user-originated)
- New names avoid "custom", which says nothing when everything admins build is custom. (user-originated)

## Logic on the expression language

- Beyond what the spec already moves (variables, visibility, required-if, options, splits), these move onto the expression language too: field validation, including checks across fields such as a pair of toggles that can't both be off; initial values and prefill from earlier answers; and the visibility of results-view blocks. Simple limits (minimum, maximum, length) stay declarative settings on the field. (agent-proposed, user-approved)
- The row list (one form's per-member rows and their row conditions) moves into data tables (ALL-2175) and the experiments table (ALL-2191) instead of being converted. This changes the spec's requirement that "this work leaves variants and row lists unchanged", which now holds for variants only. (agent-proposed, user-approved)

## Moving to the new format

- Once the new system can express a form, duplicating an action or pasting form JSON produces the new format or refuses; it never creates an old-format form. (agent-proposed, user-approved)
- How existing forms are converted is left unspecified until ALL-2185 is picked up. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- The old form system may keep getting new features when a new task needs them, since the new system may take a long time to build. This changes the spec's requirement that existing suites and forms keep running on the current code "apart from the old-system changes this file names": the old system may now also take other features a new task needs. (user-originated)

## Previous answers across a project

- Previous-answer inputs (ALL-2173) gain a project scope when a form first needs it: "the latest answer to question key K from earlier actions in this project", where K is an explicit question key that duplicated forms keep, not the field id, and responses across the project are ordered as the spec orders one form's. (agent-proposed, user-approved)

## Account checks a step waits on

- The account checks admins use today ("custom validators") split into two kinds: (agent-proposed, user-approved)
  - **Facts** about the member, such as tags, communities and whether they have a phone number, are inputs, frozen or refreshed like any other input, and may drive visibility.
  - **Requirements** are things the member goes and does elsewhere: uploading a profile photo, signing a contract, adding a profile description, replying to a forum post. They are never frozen. The server checks their current state when the member presses Next, when the member returns to the app, and at submit, and they never drive visibility. A step with an unmet requirement links to where the member does it. Where the requirement is the whole action, such as a forum reply, the action completes when the event happens.
- An unmet requirement is a reason to refuse a submission. This adds to the spec's list of refusal reasons ("An older fill session or a changed input is never a reason to refuse a submission…"), and a requirement's submit check reads current state rather than the load the submission came from ("Each load gets a server-side id…"). The fill session records each requirement check's result and time, so any submission can still be explained later. (agent-proposed, user-approved)
