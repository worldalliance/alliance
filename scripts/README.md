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
Drops and recreates the local db named by `server/.env`, then restores the dump and clears push tokens. `RESET_LOCAL_DB=0` skips the drop; `LOCAL_DB_NAME` and the `LOCAL_PG*` vars override the target.

`disable_action_update_texts_emails.sh [staging|prod] [--apply]`
Turns "Action updates" texts and emails off for every account, except where the member chose a setting themselves. Runs over SSH from the staging host, which holds both databases' credentials. Without `--apply` it rolls back and only prints before/after counts. Override `SSH_HOST_ALIAS`, `REMOTE_ENV_FILE`.

## Deploy

`deploy_backend.sh`
Run by `deploy.yaml` on the backend host, not locally. Swaps `~/nest-build.zip` in as `~/nest-backend`, migrates, and rolls back to the old release on failure. A release that applies RemoveStreakRecognition stops the backend first and reverts the removal if the new backend fails; if that revert fails, the backend is left stopped and the job fails with an `::error::`.

## Other

`check-gitignore.sh`
Two checks, both run by `bun run gitignore:check` and by CI. A tracked file matched by a .gitignore rule is one that anything re-applying those rules then drops. A rule like `android/` or `**/android/` matches at every depth, so it has to be anchored or listed in `gitignore-any-depth.txt`, whose every entry has to match a rule. The header says what each one costs when it slips.

`dupcheck.ts [--base <ref>]`
Lists duplicated code, and text of five or more words repeated verbatim, that the working tree has and its merge-base with `<ref>` (default `origin/main`) doesn't. Some matches are code that should stay separate, so it exits 0 either way and 2 only when the scan fails. `.jscpd.json` at the repo root sets the scanned paths for both and the minimum clone size. Prefer `bun run dupcheck`.

`covercheck.ts [--base <ref>]`
Runs `bun test --coverage` in each package of `test-all.sh`'s `PACKAGES` that owns a changed file, or in all of them when a changed file is in `common`, `shared`, or `sharedweb`, then lists the lines the working tree changed since its merge-base with `<ref>` (default `origin/main`) that no unit test ran, and changed files no test loaded. Scans the paths `.jscpd.json` scans, skipping test files. Exits 0 either way and 2 only when the run fails. Prefer `bun run covercheck`.

`wikicheck.ts [root]`
Checks `docs/wiki` structure against the files git tracks or doesn't ignore in the checkout at `root` (default: this repo): every local link and fragment resolves, no link is raw HTML, source citations use in-range `#L<n>` or `#L<n>-L<m>` anchors, every page has a title, `index.md` is well-formed and lists every topic page, and `coverage.md` has a well-formed row for each `docs/provenance` directory. Prints `file:line:column: message` per problem and exits 1 on any. Never fetches external links and cannot judge whether a page is accurate. Prefer `bun run wikicheck`.

`test-all.sh [package...]`
Runs unit tests from inside each workspace so its `bunfig.toml` applies. No arguments runs every package. Prefer `bun run test`, which calls this; CI calls it per package.

`brand/og.py`
Renders the Open Graph link-preview cards into `apps/frontend/public/` with headless Chrome. Commit the regenerated PNGs. Needs Chrome; override with `CHROME=`.

`brand/youtube.py`
Renders the YouTube banner and avatar into the repo-root `brand/` with headless Chrome. Needs Chrome; override with `CHROME=`.
