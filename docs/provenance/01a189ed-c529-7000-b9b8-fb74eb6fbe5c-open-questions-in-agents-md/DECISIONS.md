# Decisions

- The format lives in the root `AGENTS.md` under **Open questions**, the single source the spec and implement skills point at. The root file loads every turn in every harness. The format was previously reachable only through a sentence in the implement skill pointing at the spec skill, which is user-invoked only, so agents asking questions outside implementation, such as while debugging or auditing, never reached it.
- No skill restates which provenance origin each kind of answer gets. `(root)/skills/provenance/SKILL.md` already defines user-originated, agent-proposed and user-approved, and deferred choices, and every task that records an answer reads it.
- The format stays in the root `AGENTS.md` rather than the provenance skill, because an agent can reach a provenance-bound question, such as a product decision surfaced while debugging, before it has decided to make a change and opened that skill.
