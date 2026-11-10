---
user: Charles Lien
task: Audit the ux-guidelines skill against industry-standard UI and UX guidance and add what it lacks, including things not yet thought of, such as colorblindness
---

This task's skill changes build on `docs/provenance/01a1b363-ecb5-7000-b89b-20daf7d11033-ux-guidelines/`.

## Guidelines skill

- Research standard UI guidelines with subagents, and audit `agents/skills/ux-guidelines/SKILL.md` against them for what needs adding. (user-originated)
- The skill takes the accuracy fixes from the audit and about 23 rules, chosen because the repository shows the failure or the consequence is serious, an agent would not do it unprompted, and it recurs across tasks. (agent-proposed, user-approved)
- The 17 new rules are: page structure; link purpose and link versus button; autofill purpose with autocorrect off; native text scaling and screen readers; toast use; disabled submit; validation timing; switch versus checkbox; unsaved work; plain language with verb-led labels; tokens with reading measure and start-aligned text; report and block; private content out of replay; leaving as easy as joining; chat scroll position; state surviving Back and Reload; absolute times naming a timezone. (agent-proposed, user-approved)
- The rest extend existing rules: colour never the only carrier of state, status colours reserved, inline links underlined, chart series distinguishable, focus and placeholder contrast and `outline-hidden`; focus after view changes and native `onRequestClose`; tooltips holding short text only; gesture alternatives by single pointer; an absent value never showing as 0; a placeholder not serving as a label and digit identifiers as text; how to check, naming only tooling the repository has. (agent-proposed, user-approved)
- A failure's information stays available, rather than toasts being limited to confirmations, and the rule against `type="number"` covers digit identifiers rather than all numeric fields. (agent-proposed, user-approved)

## Existing code that breaks the new rules

- This change touches the skill only. It ships without a ratchet, as a waiver of the root `AGENTS.md` **Breaking changes** ratchet requirement for this change, and lint for the mechanically checkable rules goes in Linear issues. (agent-proposed, user-approved)
- Color tokens are not migrated in this change. (agent-proposed, user-approved)
- Session replay's capture of private text is filed as a Linear issue, with no change to PostHog or replay configuration in this task. (agent-proposed, user-approved)
