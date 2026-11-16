---
user: Charles Lien
task: Do ALL-2208 (remove the .env secrets fallback and delete the old local-dev IAM users) and open its PR; run the one-time steps once the PR is reviewed and ready to merge.
---

# Requirements

The contract step of ALL-1964 (`docs/provenance/01a1c17a-5e56-7000-9532-6e9b2f682623-local-dev-parameter-store/`), as Linear issue ALL-2208 describes it. Origin: the issue's work list, user-approved by asking for the issue to be done.

1. Remove the `.env` secrets fallback, `ALLIANCE_SECRETS_ENV_FALLBACK`, and its tests: the fallback block in `scripts/with-secrets.sh` and the env-file credentials in `agents/chats/chats.ts`.
2. Remove the docs describing the fallback (`docs/local-secrets.md` "Until the rollout finishes", the fallback paragraph in `agents/README.md`), keeping the cleanup instructions in some form: delete the listed keys from `server/.env` and `.env.devtools` in each checkout and worktree.
3. `scripts/new-worktree.sh` stops copying secrets into new worktrees, while still copying the per-checkout keys in `server/.env`.
4. Terraform deletes the `alliance-agent-chats` and `alliance-dev` IAM users, with their policies and access keys.
5. One-time steps run once the PR is reviewed and ready to merge, not before (user-originated): check that neither old user's access keys have been used recently, `terraform plan -out` from the branch destroying only those resources, apply that saved plan, then merge right away.
6. The PR closes ALL-2208 and ALL-2046 (the `alliance-dev` user's write access to the production assets bucket), which deleting that user fixes.
