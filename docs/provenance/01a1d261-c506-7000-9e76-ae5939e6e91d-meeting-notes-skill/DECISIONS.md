# Decisions

- The skill is user-invoked (`disable-model-invocation: true`, so no `AGENTS.md` pointer): it only ever starts when the user types it, which costs no always-loaded context. (agent decision, per `agents/skills/writing-for-agents/SKILL-MECHANICS.md`)
- It is separate from the `spec` skill, which interviews the user about one feature. This one collects many notes first and clarifies them afterwards. (agent decision)
- `AskUserQuestion` replaces the root `AGENTS.md` plain-text format for open questions inside this skill, because the user asked for it. The skill states the departure so a later agent keeps it. (agent decision, applying the user's request)
- Lessons from the session the skill came from (`docs/provenance/01a1d24a-3b37-7000-ac67-48ff946fe942-kora-review-ui-feedback`):
  - Build spec locates every instance of an element before asking. The Undo question there named only the toast link and missed a header button. (agent decision)
  - It measures notes that are about measurements instead of assuming. The header-gap note there went out as an assumption. (agent decision)
  - It runs follow-up rounds, as the Undo answer there needed. (agent decision)
- Notes live in `.scratch/` until implementation starts. Provenance begins with the implementing task, whose `REQUIREMENTS.md` takes the spec's decisions. (agent decision)
