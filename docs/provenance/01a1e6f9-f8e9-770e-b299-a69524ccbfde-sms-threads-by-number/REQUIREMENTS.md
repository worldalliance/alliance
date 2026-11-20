---
user: Charles Lien
task: Spec and implement text threads in the admin app for any phone number, member or not, since inbound texts arrive from numbers that belong to no member.
---

# Requirements

1. Staff get a text thread for any phone number, whether or not a member has that number, including numbers that text the Alliance without being members. Today threads exist only for members: `docs/provenance/01a1c8bb-da2e-7400-b37b-cbd09b464582-member-sms-chat` specified a thread on each member's page and a Needs reply list of members. (User-originated.)
2. Before the design questions are put to the user, each one gets an independent second opinion from a codex subagent, a brainstorming subagent produces at least 20 varied questions (some allowed to be irrelevant) to find missing ones, and a research subagent finds the established industry practice for each question where one exists. (User-originated.)
3. Implement the spec in the same PR as the spec. (User-originated.)
4. Staff take a number off Needs reply with "Mark handled" and put it back with "Mark needs reply", the model, history and undo that `docs/provenance/01a1e5b4-c35c-73d0-bb63-4b9e36ad6729-mark-texts-handled` added, named that way everywhere; there is no separate "No reply needed" marker. (User-originated.)
5. The Mark handled and Mark needs reply controls appear on each number's thread page as well as on the member page; the Needs reply list still has no per-row control. This supersedes `docs/provenance/01a1e5b4-c35c-73d0-bb63-4b9e36ad6729-mark-texts-handled`'s requirement that the control is only on the member page. (Agent-proposed, user-approved.)
6. The per-number opt-out writes and the reads that prefer them ship in one release, and the user accepts the gap a rolling deploy or a rollback leaves: a STOP handled by the new release and then a START by the old one keeps the number refused under the new release until it texts START again. (Agent-proposed, user-approved.)
7. The branch is brought onto `main` before it is pushed. (User-originated.)
