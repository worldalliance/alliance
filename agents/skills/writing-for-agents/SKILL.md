---
name: writing-for-agents
description: Read before writing or editing any doc primarily meant for agents — SKILL.md, AGENTS.md, CLAUDE.md, docs those point at.
---

# Writing for agents

The reader is a capable agent that lacks your context. Give it what it can't work out for itself, and leave the method to its judgement.

- **Purpose first.** Say what the doc is for and what a good result looks like, so the agent can settle cases the doc doesn't name.
- **What it can't derive:** values, locations, the reason behind a choice that looks wrong, a failure and its cause. Skip what one `grep`, `ls` or `--help` would show.
- **Constraints with their reasons.** Write steps only where their order does work, such as setup, safety or an irreversible action.
- **Where it goes.** A rule true across a subtree at all times goes in the nearest `AGENTS.md`; one needed for a kind of task goes in a skill, and reference only some of its cases need goes in a file beside it. Each sits behind a line saying when to read it: Claude and Codex both discover skills, through `.claude/skills` and `.agents/skills`, by their `description`, and the nearest `AGENTS.md` also points to each one, for agents that read only `AGENTS.md`, with a line written to match that description. A skill only a person starts sets `disable-model-invocation: true` for Claude and `allow_implicit_invocation: false` under `policy:` in its `agents/openai.yaml` for Codex, as `action-ideation` does, and needs no pointer. `CLAUDE.md` is `@AGENTS.md` and nothing else.
- **Keep it current.** A correction replaces the line that was wrong instead of adding a rule beside it, and a rule whose reason is gone goes. Keep each fact in one place. A path or heading reference breaks silently when its target moves, so the edit that renames, moves or deletes a file or heading updates every reference to it, except in earlier tasks' provenance, which records the repository as it stood.
