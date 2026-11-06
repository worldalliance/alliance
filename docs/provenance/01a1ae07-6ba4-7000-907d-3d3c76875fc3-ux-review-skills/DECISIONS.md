---
user: Charles Lien
task: A workflow that compares the Alliance's UI with similar established products (screenshots taken or found online), has a mix of Claude and Codex judges compare polish, UI, UX and friction and suggest items, and has agents build alternative prototypes the user picks from, without implementing the items; plus a skill holding the industry-standard UI and UX guidelines, for the Alliance agent desktop app and the main Alliance product
---

## Research records

- The root `AGENTS.md` **Established practice** rule, where agents decide to research, also says where the research goes, so an agent that never opens the provenance skill still records it (agent decision).
- `EVIDENCE.md` holds research into sources outside the repository, the kind the **Established practice** rule calls for, and, in a section of their own with method, versions and date in place of a source and status, the measurements, incidents and experiments a decision rests on, whether of a dependency or of the repository's own code, since a decision's rationale needs something kept after the session to cite. Checks that only verify the task's own change go in the handoff, since they support no choice; a run of the change that a decision rests on is an experiment and stays, so the decision has something to cite (agent decision).
- The research in `EVIDENCE.md` references neither `REQUIREMENTS.md` nor `DECISIONS.md`, so redoing research never means editing what cites it; `DECISIONS.md` cites `EVIDENCE.md` instead (agent decision).
- An `EVIDENCE.md` that already holds a check log or a reference to `DECISIONS.md` keeps it and takes research under its own heading, since older tasks' `EVIDENCE.md` files hold such content and another task's provenance is never edited (agent decision).

## Source statuses

The root `AGENTS.md` **Established practice** rule names research-backed practice as a source status and defines it and vendor recommendations, so this task's research has a defined status for each of its sources, usability studies in particular (agent decision).
