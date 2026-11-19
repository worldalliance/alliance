---
user: Charles Lien
task: Fix ALL-2338 (concurrent dev apps share one CODEX_HOME without a cross-process setup lock) and ALL-2341 (Claude processes inherit Codex's credential variables) in the Alliance agent.
---

# Requirements

- Every Claude process the app starts drops `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` from its inherited environment, as it already drops `OPENAI_API_KEY`. Other `CODEX*` variables, such as `CODEX_CA_CERTIFICATE`, still pass through. (ALL-2341-proposed, user-approved)
- Every Claude process the app starts also drops every `OPENAI_*` variable and `CODEX_CONNECTORS_TOKEN`, and every Codex process it starts drops every `CLAUDE*` variable, so a Codex process inherits nothing from Claude's namespace and a Claude process inherits no Codex credential, only the other `CODEX*` settings the bullet above lets through. (agent-proposed, user-approved)
- Which of the user's other credentials, such as `GH_TOKEN` or `AWS_*`, agent sessions inherit is decided separately from this task, in a Linear issue. (agent-proposed, user-approved)
