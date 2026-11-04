---
user: sidsquid
task: Unblock the GitHub push of main that secret scanning rejected
---

# Decisions

- **Rewrite the unpushed HEAD commit** rather than adding a follow-up that deletes the file. GitHub push protection scans every commit in the push, and the blocked SHA had not reached `origin/main`. Origin: agent decision.
- **Keep `server/.infisical.yaml` in the commit.** It holds only the Infisical project id, which GitHub did not flag. Origin: reconstructed from the blocked commit and Infisical's committed project-config practice.
- **Ignore `.env.infisical` next to the existing `.env` rules in `server/.gitignore`.** That filename is Infisical's local export; `.env` alone does not match it. Origin: agent decision.
- **Do not rotate AWS keys as part of this change.** The objects were uploaded in the rejected pack, so rotation is still warranted; it is an AWS console action, not a repository change. Origin: agent decision.
