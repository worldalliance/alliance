---
user: Charles Lien
task: Fix ALL-2013 and open a PR. The issue's details aren't set in stone; have a codex agent research the general industry standard for file size limits, put its conclusions in EVIDENCE.md in this directory, and work off that instead of the issue's description.
---

# Requirements

- Revise the **File size** rule in the root `AGENTS.md` (Linear ALL-2013). User-originated.
- Base the revision on research by codex subagents, recorded in `EVIDENCE.md` in this directory, rather than on the changes proposed in ALL-2013's description. Research questions that come up along the way get their own codex researcher. User-originated.
- Open a PR with the change. User-originated.
- A file over 500 lines kept whole carries a waiver that works as a ratchet: it records the file's ceiling, and any change taking the file past that ceiling repeats the split step, then splits the file or raises the ceiling with a revised reason. Waived files must not keep growing unexamined. Agent-proposed, user-approved.
- An ESLint check enforces the waiver's fixed wording and count through the existing `alliance/max-lines` rule. User-originated.
- Waiver ceilings are always multiples of 50 above 500: a file's ceiling is its non-blank line count, the waiver line included, rounded up to the next multiple of 50. `alliance/max-lines` reports a waiver whose count is not a multiple of 50 or is 500 or less; a file past its ceiling, asking to split it or raise the waiver to the rounded-up count; a file whose rounded-up count is below its ceiling, asking to lower the waiver to the rounded-up count; and a waiver on a file back within 500, asking to remove it. A waiver the rule suggests uses the rounded-up count with the waiver line counted. User-originated.
