---
user: Charles Lien
task: Fix ALL-2338 (concurrent dev apps share one CODEX_HOME without a cross-process setup lock) and ALL-2341 (Claude processes inherit Codex's credential variables) in the Alliance agent.
---

# Requirements

- Development apps from every checkout keep sharing one CODEX_HOME, so a developer signs in to Codex once. (agent-proposed, user-approved)
- Codex app-server setup on a CODEX_HOME holds a cross-process lock on that home, taken with the `proper-lockfile` npm package, so setups from different processes sharing it never overlap. (ALL-2338-proposed, user-approved)
- The Codex capture script takes the same lock, including around its deletion of the shared `config.toml`. (agent-proposed, user-approved)
- Every Claude process the app starts drops `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` from its inherited environment, as it already drops `OPENAI_API_KEY`. Other `CODEX*` variables, such as `CODEX_CA_CERTIFICATE`, still pass through. (ALL-2341-proposed, user-approved)
- Every Claude process the app starts also drops every `OPENAI_*` variable and `CODEX_CONNECTORS_TOKEN`, and every Codex process it starts drops every `CLAUDE*` variable, so a Codex process inherits nothing from Claude's namespace and a Claude process inherits no Codex credential, only the other `CODEX*` settings the bullet above lets through. (agent-proposed, user-approved)
- Which of the user's other credentials, such as `GH_TOKEN` or `AWS_*`, agent sessions inherit is decided separately from this task, in a Linear issue. (agent-proposed, user-approved)
