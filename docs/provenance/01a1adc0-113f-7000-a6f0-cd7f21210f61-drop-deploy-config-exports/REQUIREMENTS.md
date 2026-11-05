---
user: Charles Lien
task: Do ALL-2011, stop exporting committed config in the backend deploy, and open a PR.
---

# Requirements

- The backend deploy (`deploy-nest-backend` in `.github/workflows/deploy.yaml`) stops exporting the committed config keys and the derived URLs, the `BACKCOMPAT(ALL-2011)` block, and the committed RDS CA bundle as `DB_CA_CERT`, the `BACKCOMPAT(ALL-1963)` block, now that staging and production each run a release whose server reads both from the repo. (user-originated, from Linear ALL-2011)
