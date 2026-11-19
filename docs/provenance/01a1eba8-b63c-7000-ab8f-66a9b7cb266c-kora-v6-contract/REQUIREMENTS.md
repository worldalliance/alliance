---
user: Alex Dorey
task: Spec out the changes to the review tool for KORA's spec v6
---

- Specify the changes KORA's spec v6 requires of the review tool. The spec
  covers the `kora-review` package in full and the contract it needs from its
  host: what the host passes in, what the export carries, what the server must
  decide. Server internals, the participant sign-up screens and the admin
  interface are named only as obligations the tool depends on. User-originated.
- The spec is not published in this repository, which is open source, because
  it is not necessarily ready for the public to see. It lives in the KORA spec
  working area outside the repository. User-originated.
- Changes to the admin interface are minimal in this phase: only what is needed
  to import conversations in the new format and keep the existing batch screens
  working. The v6 dashboard metrics wait. User-originated.
- The pair task is deleted outright rather than kept working beside single
  conversations: the pair screens, the ranking logic and the pair schema go,
  and existing pair batches and assignments are dropped before launch. No
  reviewer is mid-assignment. Agent-proposed, user-approved.
- The v6 conversation and export schemas land in `docs/kora/`, replacing the
  hand-written three-table export schema of spec 5.2. `KORA_SPEC.md` 6.0 and
  the 88 test conversations stay out of the repository. Agent-proposed,
  user-approved.
- The first phase of the build order the spec sets out is implemented straight
  after it: the import contract — the conversation schema, the converter from
  KORA's file, the upload validation of section 10, fixtures and tests. The
  tool rebuild and the server's session and queue work follow in later phases.
  User-originated.
- Clarifications on this task are asked with the AskUserQuestion tool.
  User-originated.
