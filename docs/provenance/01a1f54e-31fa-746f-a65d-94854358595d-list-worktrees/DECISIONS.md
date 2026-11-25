# Decisions

## The script is `scripts/list-worktrees.ts`, run with `bun`

The issue names `scripts/list-worktrees`. A `.ts` file is what `common`'s typecheck and eslint cover and what the other Bun scripts in `scripts/` are named; an extensionless file would be skipped by both. Agent decision.

## Record validation stays in bash, called from the TypeScript

The requirement allowed either one validator called from TypeScript or two validators pinned by a shared fixture test. The script runs one `bash` process that sources `worktree-paths.sh` and `worktree-registry.sh` and prints `record_problem` for every directory under `instances/`, NUL-separated. One validator cannot drift, and `rm-worktree.sh` refuses exactly the records the listing calls `invalid`. The cost is about two seconds for some twenty records on the author's machine, from `record_problem`'s per-field `awk` and `git check-ref-format`; acceptable for a list the desktop app reads on demand. Agent decision.

## Which repository

The repository holding the working directory, like `git` itself, rather than the one holding the script. Bun resolves `import.meta.dir` through symlinks (EVIDENCE.md), so a checkout whose `scripts/` is a symlink (the test fixtures) would otherwise list the repository the link points at. Agent decision.

## States and how each is told

- `main`: git's first worktree.
- `half-removed`: the record has the `removing` link `rm-worktree.sh` sets on everything a removal selects before touching anything. It therefore also covers descendants a stopped removal never reached, which a removal does include.
- `half-created`: any other valid record whose `created` field is not `1`, or whose checkout lacks its directory, its git registration (or git marks it prunable) or the instance file naming this record. `new-worktree.sh` writes `created=0` into the record and sets it to `1` as its last step, after `bun install`; no file in the checkout marks the end of a creation, since `.worktree/ports.json` is written before the worktree `AGENTS.md`, the `server/.env` database overrides and the install. A record without the field predates it and counts as created when its checkout has `.worktree/ports.json` (`BACKCOMPAT(worktree-created-field)`). The script does not query Postgres, so a database dropped by hand afterwards goes unseen. An in-progress creation or removal is indistinguishable from a stopped one here, so the state reports what exists, as the issue's review notes asked.
- `invalid`: `record_problem` rejects the record, an instance file names a record that does not exist, or a record claimed by a checkout's instance file names a different directory (the mismatch `checkout_identity` dies on).
- `unrecorded`: a git worktree no instance file or record directory claims, including worktrees made by `new-worktree.sh` before records existed.

A git worktree with no instance file whose path a record's `dir` names is joined to that record, since `new-worktree.sh` registers the worktree before writing the instance file; otherwise that window would list the same checkout twice. For the same reason, when a checkout's instance file names some other record, or none that exists, a record naming that checkout's directory is folded into its entry's `problem` rather than listed again as an orphan, so each path appears once. Agent decision.

## Field choices

- `id` is included because `parent` is `main` or a record id, and a reader needs ids to build the tree.
- `problem` is on every entry, not only `invalid` ones: a checkout's malformed `.worktree/ports.json` reports there with `ports: null`, so one broken checkout does not fail the whole listing. A worktree whose `.git` is a directory, its own repository rather than a link to this one, has no instance file and is listed like any other, matching `admin_dir_of` in `worktree-paths.sh`.
- `branch` is git's checked-out branch when git has the worktree, else the record's; `null` when detached.
- `name`, `parent` and `id` are `null` without a record; no name is guessed from the directory.
- `locked` and `prunable` are booleans; git's reasons are left out until someone needs them.
- An `invalid` record's raw `name`, `branch` and `parent` are shown so a reader can say which record is broken, but its `ports` are `null`.

Agent decisions.

## Ports

A complete recorded checkout's ports come from its `.worktree/ports.json`, which is what its dev servers bind; a missing or malformed file, or ports differing from the record's `slot`, becomes the entry's `problem` while the state stays `recorded`, as it stays `unrecorded` for an unrecorded checkout. A record without a complete checkout shows the ports its `slot` claims, through `slotPorts` in `common/src/dev-ports-base.ts`. The main checkout and unrecorded worktrees go through `resolveDevPorts` with an empty environment, which reads the checkout's `.worktree/ports.json` or falls back to the base ports. That is what their dev servers bind unless a `SERVER_PORT`-style override is set in their `.env` files or shell, which the listing does not read: overrides are a main-checkout escape hatch `new-worktree.sh` strips from every worktree, and reading each app's env files would duplicate how each dev server loads them. A prunable one, with no directory, gets `null`. `new-worktree.sh` still computes ports in bash from `scripts/ports.ts --base`; moving it onto `slotPorts` is outside this task. Agent decision.

## Reading without the registry lock

The listing takes no lock, so a slow reader never holds up `new-worktree.sh` or `rm-worktree.sh`. A removal deletes a record by moving its directory away whole, so a record directory gone by the time its fields are read is dropped rather than listed as `invalid`. Agent decision.
