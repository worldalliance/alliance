# scripts

Run from the repo root. Everything not listed here is a helper called by these scripts or by a `package.json` script.

## Worktrees

`new-worktree.sh <name> [--branch <branch>] [--from <ref>]`
Creates a git worktree with its own ports and database, as a child of the checkout it runs in: the main checkout or a worktree it created. A new branch starts at that checkout's HEAD unless `--from` names another ref, and an existing `--branch` is checked out as it is; config and the starting database come from the main checkout. Also `bun run worktree:new`.

`rm-worktree.sh <name>`
Removes a worktree created above and its descendants, children first: checkouts, databases, port slots, and branches the script created, unpushed commits and uncommitted work included. A branch that existed before its worktree is kept; remotes are never touched. A failure leaves what it could not remove, plus its ancestors, and exits nonzero; rerunning finishes once that is resolved. It refuses a removal that includes the checkout it runs in. Records live in `.git/alliance-worktrees/`. Also `bun run worktree:rm`.
`--list` prints the names it accepts. Those names tab-complete in zsh once `scripts/completions` is on `fpath` ahead of `compinit`; the script's header has the two lines to paste into `~/.zshrc`.

`list-worktrees.ts`
Prints every worktree of the repository holding the working directory as versioned JSON, each git worktree joined to its record, plus records git has no worktree for, each with a state such as `half-removed` or `invalid`. It is for the desktop app, which reads it instead of the record files. `--help` describes every field.

`with-env.sh [command...]`
Runs a command with this checkout's worktree env sourced. No arguments prints the resolved ports and database names, which is what `bun run ports` does.

## Database

`load_staging_data.sh`
Download plus restore in one step. This is the one you usually want.

`download_staging_data.sh`
Pulls a `pg_dump` of staging over SSH into `./db_dumps`, run on the staging host through its `with_db_env.sh`. Override `SSH_HOST_ALIAS`, `DUMP_DIR`.

`restore_staging_data.sh <dump-file>`
Drops and recreates the local db named by `server/.env`, then restores the dump and clears push tokens. `RESET_LOCAL_DB=0` skips the drop; `LOCAL_DB_NAME` and the `LOCAL_PG*` vars override the target.

`disable_action_update_texts_emails.sh [staging|prod] [--apply]`
Turns "Action updates" texts and emails off for every account, except where the member chose a setting themselves. Runs over SSH on the target's own host (SSH host alias `staging` or `prod`) through its `with_db_env.sh`, as that server's database login. Without `--apply` it rolls back and only prints before/after counts. Override `SSH_HOST_ALIAS`.

## Secrets

`with-secrets.sh <consumer> <command...>`
Runs a command with the consumer's dev secrets from `/alliance/dev/<consumer>/` in AWS SSM Parameter Store, read with the person's `alliance-dev` login. `dev-secrets.json` lists each consumer's keys. Setup and adding a secret: `docs/local-secrets.md`.

`setup-without-team-secrets.ts`
Writes `server/.env` for running the server without team credentials and prints the seeded admin's login. See `docs/local-secrets.md`.

## Deploy

`deploy_backend.sh`
Run by `deploy-environment.yaml` on the backend host, not locally. Swaps `~/nest-build.zip` in as `~/nest-backend`, migrates, and rolls back to the old release on failure. A release that applies RemoveStreakRecognition stops the backend first and reverts the removal if the new backend fails; if that revert fails, the backend is left stopped and the job fails with an `::error::`.

`secrets_run.sh <command...>`
`secrets_run.sh --path <prefix> [NAME...] [--path ...] -- <command...>`
Run on the backend host, not locally; the deploy installs it as `~/secrets_run.sh`. Runs the command with the parameters under `/alliance/<env>/server/` in AWS SSM Parameter Store as env vars, `<env>` picked by `NODE_ENV`, read with the host's instance role. The `--path` form reads each prefix instead, without `NODE_ENV`, keeping only the listed names where a prefix lists any, and fails on a listed name a prefix lacks or a name two prefixes both set. Setup, rotation and running without Parameter Store: `docs/backend-secrets.md`.

`with_db_env.sh <staging|production> <command...>`
Run on that environment's backend host from `~/nest-backend`, not locally; the deploy ships it there. Runs the command with libpq's `PG*` variables set to the server's own database login, verifying the RDS certificate. See "Database access from the backend hosts" in `docs/backend-secrets.md`.

`check-parameter-drift.ts [--required]`
Run by `parameter-drift.yaml`. Lists the parameter names under `/alliance` in AWS SSM Parameter Store and fails when a path lacks a key its schema or `dev-secrets.json` requires, or holds one undeclared there or in `SHARED_KEYS`, or when a name outside the CI paths is under no path it checks. `--required` prints each path's required keys and needs no AWS login. See `docs/backend-secrets.md`.

`deployed-config.ts <staging|production>`
Prints the values from `common/src/deployed-config.ts` that `deploy-environment.yaml`'s deploy, verification and source map jobs read, as `KEY=value` lines for `GITHUB_OUTPUT`.

`deployed-db-name.ts <staging|production>`
Prints the environment's `DB_NAME` from `common/src/deployed-config.ts`. The deploy ships it to the backend host, for the scripts there that need a database name.

`web-runtime-config.ts <staging|production>`
Prints the environment's web runtime config from `common/src/web-runtime-config.ts` as JSON. `deploy-environment.yaml` uploads it, and the admin host serves it as `/config.json`.

## Other

`check-gitignore.sh`
Two checks, both run by `bun run gitignore:check` and by CI. A tracked file matched by a .gitignore rule is one that anything re-applying those rules then drops. A rule like `android/` or `**/android/` matches at every depth, so it has to be anchored or listed in `gitignore-any-depth.txt`, whose every entry has to match a rule. The header says what each one costs when it slips.

`dupcheck.ts [--base <ref>]`
Lists duplicated code, and text of five or more words repeated verbatim, that the working tree has and its merge-base with `<ref>` (default `origin/main`) doesn't. Some matches are code that should stay separate, so it exits 0 either way and 2 only when the scan fails. `.jscpd.json` at the repo root sets the scanned paths for both and the minimum clone size. Prefer `bun run dupcheck`.

`covercheck.ts [--base <ref>]`
Runs `bun test --coverage` in each package of `test-all.sh`'s `PACKAGES` that owns a changed file, or in all of them when a changed file is in `common`, `shared`, or `sharedweb`, then lists the lines the working tree changed since its merge-base with `<ref>` (default `origin/main`) that no unit test ran, and changed files no test loaded. Scans the paths `.jscpd.json` scans, skipping test files. Exits 0 either way and 2 only when the run fails. Prefer `bun run covercheck`.

`test-all.sh [package...]`
Runs unit tests from inside each workspace so its `bunfig.toml` applies. No arguments runs every package. Unsets git's repository-local variables (`git rev-parse --local-env-vars`) first, as covercheck does, since `git rebase --exec` exports `GIT_DIR` and the scripts tests' fixture repos would write to the real one; started any other way with one set, a scripts test exits if run from the repo root or `scripts/`, or from anywhere if it uses `fixture-git.ts`. Prefer `bun run test`, which calls this; CI calls it per package.

`brand/og.py`
Renders the Open Graph link-preview cards into `apps/frontend/public/` with headless Chrome. Commit the regenerated PNGs. Needs Chrome; override with `CHROME=`.

`brand/youtube.py`
Renders the YouTube banner and avatar into the repo-root `brand/` with headless Chrome. Needs Chrome; override with `CHROME=`.
