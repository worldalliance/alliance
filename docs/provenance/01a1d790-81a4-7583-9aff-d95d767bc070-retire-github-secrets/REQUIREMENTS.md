---
user: Charles Lien
task: Finish ALL-1965 (delete GitHub secrets, add the env-read lint ratchet, retire Infisical) in the envvars worktree and open a PR.
---

# Requirements

1. Delete every GitHub repository secret, and every secret and variable in the `staging` and `production` environments, once confirmed that no workflow on `main` or `production` reads it. The agent deletes them with `gh` after the user approves the exact list. (Agent-proposed, user-approved.)
2. Before deleting, compare the names under `/alliance/` in Parameter Store against the GitHub list, signed in with the user's admin AWS login, so that no value still needed exists only in GitHub. Compare names only, never values. (Agent-proposed, user-approved.)
3. The user deletes the Infisical `alliance` and `Alliance dev` projects. The agent removes the staging host's unused `~/db-ca.pem` through SSM Run Command. (Agent-proposed, user-approved.)
4. Restrict the `production` GitHub environment's deployment branches to `main` and `production` (ALL-1325), and close ALL-1325. (Agent-proposed, user-approved.)
