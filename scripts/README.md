# scripts

Run from the repo root. Everything not listed here is a helper called by these scripts or by a `package.json` script.

## Worktrees

`new-worktree.sh <name> [--branch <branch>] [--from <ref>] [--slot <n>] [--force]`
Creates a git worktree with its own ports and database. Main checkout only. Also `bun run worktree:new`.

`rm-worktree.sh <name>`
Removes a worktree created above and drops its databases. Run it from outside that worktree. Also `bun run worktree:rm`.
`--list` prints the names it accepts. Those names tab-complete in zsh once `scripts/completions` is on `fpath` ahead of `compinit`; the script's header has the two lines to paste into `~/.zshrc`.

`with-env.sh [command...]`
Runs a command with this checkout's worktree env sourced. No arguments prints the resolved ports and database names, which is what `bun run ports` does.

## Database

`load_staging_data.sh`
Download plus restore in one step. This is the one you usually want.

`download_staging_data.sh`
Pulls a `pg_dump` of staging over SSH into `./db_dumps`. Override `SSH_HOST_ALIAS`, `REMOTE_ENV_FILE`, `DUMP_DIR`.

`restore_staging_data.sh <dump-file>`
Drops and recreates the local db named by `server/.env`, then restores the dump. `RESET_LOCAL_DB=0` skips the drop; `LOCAL_DB_NAME` and the `LOCAL_PG*` vars override the target.

`bun list-actions.ts`
Prints every released action with a participation rate, ordered by release date. Reads the local db.

`bun get-action-form.ts <actionId>`
Prints the action's task form, form variants and follow-up forms as text. Reads the local db.

`bun ordered-action-ids.ts`
Prints the ids of every released action, most recently released first, one per line. `| head -n5` gives the five most recent.

`bun list-popular-action-ids.ts`
Prints action ids from most to least popular, one per line, excluding onboarding actions. Popularity averages each action's percentile rank for completion rate and for completion count.

`bun export-actions.ts <actionId...> [--out <dir>]`
Writes one YAML file per action into `misc/action-exports` (override with `--out`), holding the attributes the admin panel's create form assigns. `action-export.schema.yml` is the JSON Schema those files match.

## Other

`test-all.sh [package...]`
Runs unit tests from inside each workspace so its `bunfig.toml` applies. No arguments runs every package. Prefer `bun run test`, which calls this; CI calls it per package.

`brand/og.py`
Renders the Open Graph link-preview cards into `apps/frontend/public/` with headless Chrome. Commit the regenerated PNGs. Needs Chrome; override with `CHROME=`.

`brand/youtube.py`
Renders the YouTube banner and avatar into the repo-root `brand/` with headless Chrome. Needs Chrome; override with `CHROME=`.
