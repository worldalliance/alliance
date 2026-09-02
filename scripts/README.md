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

## Other

`prov.ts <start|human|decide|note|context|review|show|lint>`
The provenance store: human evidence, agent decisions, and the change episodes tying both to commits. Run it as `bun run prov`. See `.provenance/SPEC.md`.

`test-all.sh [package...]`
Runs unit tests from inside each workspace so its `bunfig.toml` applies. No arguments runs every package. Prefer `bun run test`, which calls this; CI calls it per package.

`brand/og.py`
Renders the Open Graph link-preview cards into `apps/frontend/public/` with headless Chrome. Commit the regenerated PNGs. Needs Chrome; override with `CHROME=`.

`brand/youtube.py`
Renders the YouTube banner and avatar into the repo-root `brand/` with headless Chrome. Needs Chrome; override with `CHROME=`.
