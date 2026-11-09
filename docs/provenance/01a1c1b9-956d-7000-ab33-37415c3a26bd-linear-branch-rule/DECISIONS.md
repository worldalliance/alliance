# Decisions

Agent decisions. Facts cited here are in `EVIDENCE.md`.

- **The rule lives in `agents/skills/linear/SKILL.md`,** replacing **Closing an issue**. That section held the claim being corrected. The skill's root `AGENTS.md` pointer and description name branching for a Linear issue and writing a commit or PR that names one, since an agent does all three without touching the Linear API, and a PR that only lists follow-ups it filed still needs the closing-word rule.
- **The section is renamed Linking work to an issue,** since it now covers linking. Nothing else in the repository names the old heading.
- **The skill no longer says a branch name moves an issue to In Progress.** Every keyed branch sampled also had the key in text, so the branch's own effect is unmeasured.
- **Review worktrees and automation need no case of their own.** Without an issue predating them, "other branches carry no key" covers them.
- **The 49-character limit is recorded in the skill** because `scripts/new-worktree.sh` doesn't check it, and keyed names are the ones likely to reach it.
- **The pointers stay wide, and the review-loop PR step points at the skill too.** The user deferred this choice to two independent read-only subagents, one Claude and one Codex, given four candidates. Both picked this one. The main agent writes the PR description while only the fixer is told to read the skill, so that step carries its own line.
- **The skill stays named `linear`.** The description does the triggering, and the name matches the short names of the repository's other skills.
