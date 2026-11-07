---
user: Charles Lien
task: A workflow that compares the Alliance's UI with similar established products (screenshots taken or found online), has a mix of Claude and Codex judges compare polish, UI, UX and friction and suggest items, and has agents build alternative prototypes the user picks from, without implementing the items; plus a skill holding the industry-standard UI and UX guidelines, for the Alliance agent desktop app and the main Alliance product
---

## Sources of the guidelines

The checklist in `ux-guidelines` distils EVIDENCE.md sections 1, 2 and 7. Every link in the skill was checked to resolve. What a change adds or alters meets all of WCAG 2.2 AA, which the research names as the formal floor, while the skill lists only the criteria most relevant to UI work here, so a criterion it leaves out still binds (agent decision). The per-product acceptance tests in EVIDENCE.md sections 3 and 4 stay out of the skill: they are proposals the user hasn't reviewed, and the judges derive what applies to each surface from the general items (agent decision). A **V** item cited for a platform other than the one a change targets, such as GNOME guidance applied to the web app, counts as **C** there, since a platform's guidance governs only its own conventions (agent decision).

## Local copies of the sources

- Which pages are copied whole follows each page's own notice, per EVIDENCE.md section 8: W3C, GOV.UK, web.dev and Android pages whole; NN/g, Apple, Baymard and Google Help pages, and GNOME's, whose site and repository state no licence, as excerpts (agent decision).
- A W3C page is copied verbatim, its main content only, since the W3C Document License that WAI's permission page names allows copying but not modification; the site's navigation, header and footer are not part of the document. GOV.UK, web.dev and Android pages, whose licences allow adaptation, also drop author links and page controls (agent decision).
- Excerpts quote whole paragraphs or list items, so each quote keeps the source's own wording and qualifiers (agent decision).
- Images stay links to the remote files, since agents read the text and copying images would multiply the size (agent decision).
- Pages were converted with Mozilla Readability and Turndown, Apple's from its JSON data endpoint, since the HIG pages render in the browser; the conversion script isn't kept, since a refresh is rare and re-fetching is the larger part of it (agent decision).

## The whole "UI affordances" section moved

The root `AGENTS.md` section held the icons rule plus three neighbours: inline edits over Edit toggles, a tooltip or `aria-label` on icon-only controls, and destructive actions saying what they do in words. All four moved into `ux-guidelines`, so UI rules have one home that the root file points to before UI work; the icons rule is rewritten to the approved one (agent decision). The skill splits the icon-only rule: its accessible name falls under the formal WCAG 4.1.2 item on name, role and state, and its tooltip is a vendor recommendation (EVIDENCE.md section 7) that applies only on pointer platforms, since touch has no hover (agent decision). The inline-edit item carries no status, since it was the root file's own preference and no source in EVIDENCE.md weighs it; the modes guidance beside it is EVIDENCE.md section 7's (agent decision).

Existing icon-only controls, such as the rename and new-project buttons in `apps/admin/src/components/ActionProjectControls.tsx`, break the new icons rule, and the root `AGENTS.md` **Breaking changes** rule asks for a migration and a ratchet when a rule existing code breaks is adopted. This task ships neither (REQUIREMENTS.md, Guidelines skill): the ratchet is a new lint rule with a baseline of violations and the migration changes UI in every app, code work a docs-only change would bring into a separate review. Until ALL-2080 lands, the skill binds what a change adds or alters, so the backlog doesn't grow through changed code (agent decision).

## Pointer scope

The pointer and the skill's description name `sharedweb/` and `shared/` beside the approved `apps/` and `agents/desktop`, since the UI rules they replace were always loaded and the shared components there render in every app (agent decision).

## Invocation

The skill is model-invoked with a root `AGENTS.md` pointer, so an agent reaches the guidelines before UI work on its own (agent decision).
