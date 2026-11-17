# Decisions

- **The drift check parses the manifest with zod and rejects a key listed under both `secrets` and `retiring`.** Such a key is still required, so its `retiring` entry would mislead whoever removes it; failing the check names the mistake. The wrapper doesn't repeat that check, since the drift check runs on every PR that changes `scripts/dev-secrets.json`. Origin: agent decision.
- **The wrapper stays silent about a stored `retiring` key** rather than printing its "does not list" notice, since the manifest does list it and the notice would fire on every run until the parameter is deleted. Origin: agent decision.
- **`scripts/new-worktree.sh` keeps stripping only `secrets` keys from copied env files**, not `retiring` ones. Its documented behaviour already copies a secret that has left the list, and the shared dev secrets left `.env` files under ALL-2208. Origin: agent decision.
