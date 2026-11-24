---
user: Charles Lien
task: Run the commit-review workflow's reviewers on the latest models instead of pinned versions.
---

# Requirements

- The Claude reviewer in `.github/workflows/code-review.yaml` runs on the latest Opus instead of the pinned `claude-opus-4-6`. (user-originated)
- It selects the latest Opus with Claude Code's `opus` model alias (`--model opus`) instead of omitting `--model`. (agent-proposed, user-approved)
- The Codex reviewer in that workflow sets no model, so it runs on Codex's default model. (user-originated)
