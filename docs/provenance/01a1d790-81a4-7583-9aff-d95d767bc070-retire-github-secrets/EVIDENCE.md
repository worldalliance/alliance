# Evidence

## GitHub secrets against Parameter Store

On 2026-11-13, with an admin AWS login, the agent compared every GitHub repo secret, and every `staging` and `production` secret and variable, against the names under `/alliance/` in Parameter Store (names only, never values). Each name either had a Parameter Store copy, was renamed into committed config (`common/src/deployed-config.ts`, `.github/ci.env`), or had no reference in the repo. `git grep` of `.github` on `origin/main` and `origin/production` found no workflow reading the `secrets` context beyond `GITHUB_TOKEN`.
