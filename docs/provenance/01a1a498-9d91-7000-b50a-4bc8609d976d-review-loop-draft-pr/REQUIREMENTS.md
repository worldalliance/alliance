---
user: Charles Lien
task: Have the review loop open a draft PR while it is in progress
---

- The "commit review" workflow (`.github/workflows/code-review.yaml`) skips pushes while the branch has an open draft PR, and runs when a PR is marked ready, so a finished branch gets one review. A push before the draft PR exists may still trigger one. (agent-proposed, user-approved)
