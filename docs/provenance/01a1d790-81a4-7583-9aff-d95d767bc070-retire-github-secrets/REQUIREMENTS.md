---
user: Charles Lien
task: Finish ALL-1965 (delete GitHub secrets, add the env-read lint ratchet, retire Infisical) in the envvars worktree and open a PR.
---

# Requirements

1. Delete every GitHub repository secret, and every secret and variable in the `staging` and `production` environments, once confirmed that no workflow on `main` or `production` reads it. The agent deletes them with `gh` after the user approves the exact list. (Agent-proposed, user-approved.)
2. Before deleting, compare the names under `/alliance/` in Parameter Store against the GitHub list, signed in with the user's admin AWS login, so that no value still needed exists only in GitHub. Compare names only, never values. (Agent-proposed, user-approved.)
3. The user deletes the Infisical `alliance` and `Alliance dev` projects. The agent removes the staging host's unused `~/db-ca.pem` through SSM Run Command. (Agent-proposed, user-approved.)
4. Restrict the `production` GitHub environment's deployment branches to `main` and `production` (ALL-1325), and close ALL-1325. (Agent-proposed, user-approved.)
5. Research the industry standard for storing secret files (such as an App Store Connect `.p8` key) that live in Infisical today, using a codex subagent. (User-originated.)
6. Before the Infisical projects are deleted, hash-compare their entries against Parameter Store and committed config, reporting only names and matches. (Agent-proposed, user-approved.)
7. The team has no password manager. Parameter Store is the only place secret files are kept, with no second human-held copy. (User-originated.)
8. Copy the app hosts' SSH private key from Infisical to `/alliance/shared/EC2_SSH_KEY`, kept until ALL-2063 retires the key pair. (Agent-proposed, user-approved.)
9. Copy the unidentified Apple key `F9J58D7K92` from Infisical's Storage project to `/alliance/shared/APPLE_KEY_F9J58D7K92_P8_BASE64`, kept until someone confirms it is revoked or unused. It matches none of the keys EAS holds for iOS. (Agent-proposed, user-approved.)
10. The old Claude Code OAuth token and the `alliance-gh-bot` GitHub recovery codes in Infisical's Storage project need no new home: the token is obsolete, and the user keeps the recovery codes elsewhere. (User-originated.)
