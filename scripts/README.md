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

`check-gitignore.sh`
Fails when a tracked file is also matched by a .gitignore rule, which anything re-applying those rules then drops. `bun run gitignore:check` calls it, and so does CI. The header explains what that costs and what the check cannot see.

`commit-after.sh <commit-ish>`
Prints the commit immediately after `<commit-ish>` on the path to HEAD, which is the first commit a branch adds on top of the ref it came from. Runs against the repository of the working directory. Exits non-zero with an `ERROR[...]` line when the ref does not resolve, is not an ancestor of HEAD, already is HEAD, or has several children leading to HEAD.

`test-all.sh [package...]`
Runs unit tests from inside each workspace so its `bunfig.toml` applies. No arguments runs every package. Prefer `bun run test`, which calls this; CI calls it per package.

`brand/og.py`
Renders the Open Graph link-preview cards into `apps/frontend/public/` with headless Chrome. Commit the regenerated PNGs. Needs Chrome; override with `CHROME=`.

`brand/youtube.py`
Renders the YouTube banner and avatar into the repo-root `brand/` with headless Chrome. Needs Chrome; override with `CHROME=`.
