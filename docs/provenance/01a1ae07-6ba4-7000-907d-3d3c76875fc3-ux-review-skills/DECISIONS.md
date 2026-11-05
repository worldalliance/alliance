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

## Sources of the guidelines

The checklist in `ux-guidelines` distils EVIDENCE.md sections 1, 2 and 7. Every link in the skill was checked to resolve. What a change adds or alters meets all of WCAG 2.2 AA, which the research names as the formal floor, while the skill lists only the criteria most relevant to UI work here, so a criterion it leaves out still binds (agent decision). The per-product acceptance tests in EVIDENCE.md sections 3 and 4 stay out of the skill: they are proposals the user hasn't reviewed, and the judges derive what applies to each surface from the general items (agent decision). A **V** item cited for a platform other than the one a change targets, such as GNOME guidance applied to the web app, counts as **C** there, since a platform's guidance governs only its own conventions (agent decision).

## The whole "UI affordances" section moved

The root `AGENTS.md` section held the icons rule plus three neighbours: inline edits over Edit toggles, a tooltip or `aria-label` on icon-only controls, and destructive actions saying what they do in words. All four moved into `ux-guidelines`, so UI rules have one home that the root file points to before UI work; the icons rule is rewritten to the approved one (agent decision). The skill splits the icon-only rule: its accessible name falls under the formal WCAG 4.1.2 item on name, role and state, and its tooltip is a vendor recommendation (EVIDENCE.md section 7) that applies only on pointer platforms, since touch has no hover (agent decision). The inline-edit item carries no status, since it was the root file's own preference and no source in EVIDENCE.md weighs it; the modes guidance beside it is EVIDENCE.md section 7's (agent decision).

Existing icon-only controls, such as the rename and new-project buttons in `apps/admin/src/components/ActionProjectControls.tsx`, break the new icons rule, and the root `AGENTS.md` **Breaking changes** rule asks for a migration and a ratchet when a rule existing code breaks is adopted. This task ships neither (REQUIREMENTS.md, Guidelines skill): the ratchet is a new lint rule with a baseline of violations and the migration changes UI in every app, code work a docs-only change would bring into a separate review. Until ALL-2080 lands, the skill binds what a change adds or alters, so the backlog doesn't grow through changed code (agent decision).

## Pointer scope

The pointer and the skill's description name `sharedweb/` and `shared/` beside the approved `apps/` and `agents/desktop`, since the UI rules they replace were always loaded and the shared components there render in every app (agent decision).

## Invocation

The skill is model-invoked with a root `AGENTS.md` pointer, so an agent reaches the guidelines before UI work on its own (agent decision).
