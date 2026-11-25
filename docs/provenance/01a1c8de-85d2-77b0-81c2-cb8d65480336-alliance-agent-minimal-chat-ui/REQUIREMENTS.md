---
user: Charles Lien
task: Create a PR for ALL-2032 (the Alliance agent's chat UI)
---

This task is PR 7 (ALL-2032) of the plan in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`, in the build order of `docs/provenance/01a1c1c6-c974-7000-895b-83e96db89f15-alliance-agent-real-path-first/`, whose requirements apply to it.

- Open a pull request for ALL-2032, the Alliance agent desktop app's chat UI. (user-originated)
- Before the branch is pushed and its draft PR opened, run the review loop of `agents/skills/review-loop/SKILL.md` until a round comes back clean. (user-originated)
- The commit that first lets the Alliance agent start Claude CLIs ("Expose the Alliance agent's backend to its renderer") itself closes every live session and aborts any sign-in when the app quits, so each commit of the branch is safe to deploy alone. Waiting on quit for a new session's CLI to read its first message, and removing a conversation whose CLI never read it, stay in the later quit commit. (user-originated)
