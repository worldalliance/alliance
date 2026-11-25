---
user: Charles Lien
task: Audit the agent skills, per Linear ALL-2329, on the `agents` branch.
---

# Requirements

- Audit the agent skills in `agents/skills/`, carrying out Linear ALL-2329. (user-originated)
- The audit reviews the skills written under the old `writing-for-agents` guide, judged by session transcripts. Where a skill was misread, ignored, followed into needless work, or missing something an agent had to rediscover, it is trimmed or rewritten against the current `writing-for-agents` brief; a skill the transcripts show working is left alone. (ALL-2329-proposed, user-approved)
- The work happens on the `agents` branch, not a branch named for the issue. (user-originated)
- A question the repository, its transcripts or its commands can answer is answered by checking, not put to the user. (user-originated)
- Many coworkers have a Claude subscription and no Codex one; the user has both. A step that calls for the other vendor's CLI, such as `consult`'s second opinion, runs the CLI the machine has when the other isn't set up, and the user is told which CLI isn't set up, Codex or Claude. Where a step adds a second vendor beside the first, such as a Codex reviewer beside the Claude one, a machine without it runs the first alone rather than doubling it. (user-originated)
- Handed-over material such as a Linear issue: a point that matches a requirement the user already approved, in a task no later task superseded, cites that requirement and its directory; the agent asks the user about the remaining points, per root `AGENTS.md` **Open questions**, before writing code. For points that match such a requirement, this supersedes the requirement in `docs/provenance/01a1a317-bd39-7000-92fa-8b44372b5fd6-provenance-unknown-origin/REQUIREMENTS.md` that the agent asks the user about each point of handed-over material. (agent-proposed, user-approved)
- `spec` and `debug` become loadable by agents: `spec` when the user asks to spec or plan a change, `debug` when investigating a bug or failing check whose cause is unknown. (agent-proposed, user-approved)
- On a machine where Codex is set up, every commit due a review in every round of the review loop gets a Codex reviewer beside its Claude reviewer. This supersedes the single fresh `claude -p` reviewer per commit in `docs/provenance/01a18e9e-a7d2-7000-a3e4-aeaf86a67297-automatic-review-loop/REQUIREMENTS.md`. (agent-proposed, user-approved)
- `ux-forms-platform` merges back into `ux-guidelines`. Each item keeps its status letter and the names of its sources inline, and the links to the local copies in `agents/skills/ux-guidelines/sources/` move to `agents/skills/ux-guidelines/SOURCES.md` beside the skill. This supersedes the inline links required by `docs/provenance/01a1b363-ecb5-7000-b89b-20daf7d11033-ux-guidelines/REQUIREMENTS.md` and the split recorded in `docs/provenance/01a1c284-b528-7000-b964-b5b5a3fa2c79-ux-guidelines-audit/`. (agent-proposed, user-approved)
- This PR ships the merged `ux-guidelines` skill at its full length, over the 5,000 tokens Claude Code re-attaches of a skill after compaction, without tightening its wording, splitting it or adding a reminder. A rewrite that brings it under that limit, moving what lint can enforce out of the skill, is separate later work. (agent-proposed, user-approved)
- The trim-comments reminder hook, `.claude/hooks/trim-comments-reminder.sh` with its `PostToolUse` entry in `.claude/settings.json`, is deleted. (user-originated)
