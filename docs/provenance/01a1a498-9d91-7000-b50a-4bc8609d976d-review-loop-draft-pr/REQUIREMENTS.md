---
user: Charles Lien
task: Have the review loop open a draft PR while it is in progress
---

- The "commit review" workflow (`.github/workflows/code-review.yaml`) skips pushes while the branch has an open draft PR, and runs when a PR is marked ready, so a finished branch gets one review. A push before the draft PR exists may still trigger one. (agent-proposed, user-approved)
- The review loop opens a draft PR for the branch while the loop is in progress, and marks it ready for review once the loop finishes. (user)
- While the PR is a draft, the loop force pushes after every round that changed commits, so the draft shows the branch's current state. (agent-proposed, user-approved)
- CI failures on the draft are ignored until the PR is marked ready, since the next round's commits replace what was tested; the loop acts only on CI after `gh pr ready`. (agent-proposed, user-approved)
- CI keeps running on draft PRs; `.github/workflows/ci.yaml` is unchanged. (agent-proposed, user-approved)
