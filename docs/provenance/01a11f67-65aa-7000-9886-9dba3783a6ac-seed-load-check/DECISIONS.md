## Check only, no auto-fix

- The reseed belongs in the PR whose migration breaks the load: `reseed.sh` carries the seed data across that migration, and its author knows what the migration did to the data. The past reseeds (#220, the Ongoing and Funding action type removals) were done that way.
- `reseed.sh` miscounts the migrations to revert when one merges with a timestamp older than the seed's (the Funding removal ran it with `--revert 3`), and a data migration can throw on seed rows. An unattended run would fail without explanation or commit a bad dump.
- A commit pushed with `GITHUB_TOKEN` triggers no workflows and can't reach fork PRs, which weakens option B. Option C leaves `main`'s screenshot runs broken until its PR merges.

## What fails

- A load failure, not a stale timestamp. Most migrations add tables or nullable columns, which the dump loads over; failing on the timestamp would pull the ~650 KB dump diff into every migration PR.
- The check calls `seedDatabase()` unchanged, so CI tests exactly what the screenshot runner and `pr-screenshots.yaml` load.

## Workflow shape

- `seed-load-check.yaml` stands alone with `pull_request` (branches `main`, `production`) and `push` (branch `main`) triggers. Adding `push` to `ci.yaml` would rerun every CI job on `main`.
- It runs unfiltered by path: no workflow here filters by path, and the load can break from changes outside `server/migrations/**` and `citesting/fixtures/**`, such as `seed-database.ts` itself. The job costs about as much as `migrations-drift-check`.
- Postgres 17 as a service, matching `migrations-drift-check` and `pr-screenshots`.
- A push to `main` can only fail when two PRs that each passed combine, such as a migration merged onto a dump another PR just regenerated. That is rare, and the next PR's check fails visibly, so no Slack notification.
- The `::error::` annotation prints only when the load step failed inside its "Loading seed dump" phase, so a failed install, a broken migration, or a failed timestamp shift doesn't send the author to `reseed.sh`; `reseed.sh` can't fix those. The step's log is teed to a file for that check because `seedDatabase()` runs all three phases in one call. The annotation is anchored on `seed_dataonly.sql`, the file the fix rewrites.
- The root `bun install` alone, as `migrations-drift-check` does it: the root workspace already includes `server`, `common`, and `citesting`, so `pr-screenshots`'s extra per-package installs aren't needed.
