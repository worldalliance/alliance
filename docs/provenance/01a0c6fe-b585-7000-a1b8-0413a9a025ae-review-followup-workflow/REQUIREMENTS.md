---
user: Charles Lien
task: Connect the automated review workflow to the review skills
---

- Hook up agentic-review to the review-base and review-followup skills developed in this task.
- The user's Codex launch command is `codex --sandbox danger-full-access --ask-for-approval never`.
- The user's existing sequence is Claude review, Astra assessment, then fixes in the same Astra session.
- Invoke the Codex skill using `$review-followup` syntax.
- Push only the reviewed commit to the selected remote branch, and only after a round with no accepted issues. Fixing accepted issues does not authorize that round's push.
- Also back up unreviewed commits to `origin/draft/<branch-name>`.
- Store the full agent logs, including Claude JSONL and Codex output.
- Keep fresh review context between rounds. The user explained that deleting .scratch serves the same purpose as withholding agent decisions from reviewers, and asked to update the shared review skill too.
- Keep a copy of completed rounds outside the repo for later audits and refinement. The user left the storage location open.
- The user raised required human actions, such as signing up for a service or adding a GitHub environment variable, and asked how they relate to unresolved findings.
