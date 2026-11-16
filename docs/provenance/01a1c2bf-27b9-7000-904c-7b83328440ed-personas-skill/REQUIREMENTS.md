---
user: Alex Dorey
task: Write a skill that creates personas and scenarios and commits them into the repo
---

- A skill, `agents/skills/personas/`, creates and updates personas and scenarios and commits them into the repository. (user-originated)
- The personas and scenarios serve design and UX review: judging a UI or spec from a specific person's point of view. (user-selected from agent-proposed options)
- The skill only creates and maintains the library; it does not run reviews through a persona. (user-selected from agent-proposed options)
- Personas live in `docs/personas/<slug>.md` and scenarios in `docs/scenarios/<slug>.md`, one shared library any task or skill can point at. (agent-proposed, user-approved)
- A scenario names the personas it applies to; personas name no scenarios. (agent-proposed, user-approved)
- A persona is grounded in an interview with the user and in the existing code and copy, such as the roles, permissions and flows the apps implement, so scenarios match real screens. Product data and external research are not grounds. (user-selected from agent-proposed options)
- The skill is user-invoked only: no always-loaded description and no `AGENTS.md` pointer. (agent-proposed, user-approved)
- The `ux-guidelines` skill does not point at the library. (user-selected from agent-proposed options)
- The skill writes the files, shows them, and commits on the user's approval. (agent-proposed, user-approved)
- The skill asks its interview questions with the `AskUserQuestion` tool, in place of the plain-text format root `AGENTS.md` **Open questions** prescribes. (user-originated)
