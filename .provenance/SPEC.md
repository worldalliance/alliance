# Provenance

Three kinds of record, one boundary:

- **human** — the exact words a human typed. Evidence, never an agent's summary of it. Append-only.
- **decision** — a choice an agent made. Any agent may supersede any decision, but never a human record: a record supersedes its own kind only.
- **change** — one task. Joins the human evidence that prompted it to the decisions it produced, and commits point at it by id.

A reviewer reading a diff cannot tell a requirement from an implementer's choice. That is the problem this store solves, so the boundary is the whole point: keep an agent's choice out of `human/`, whatever the human said afterwards.

## Recording a task

```bash
bun run prov start "Fix stale selection after menu close"   # prints the change id
printf '%s' 'when the menu closes the selected workspace must stay selected' \
  | bun run prov human <change>                             # exact words, on stdin
bun run prov decide <change> "Move selection ownership into WorkspaceStore" \
  --component frontend --detail "why, at whatever length"   # or --detail - to read stdin
```

Then every commit for that task carries the trailer. Git only parses the last paragraph of a message, so it goes in the same block as any other trailer, with no blank line between them:

```
Co-Authored-By: ...
Provenance: pv_019c...
```

`git log -1 --format=%B | git interpret-trailers --parse` shows what git actually sees. A `Provenance:` line sitting in its own paragraph is invisible to `prov review`.

`start` at the top of the task, `human` the moment the human states something substantive, `decide` as each choice gets made rather than in a batch at the end. A task nobody will need to explain later does not need a change record. Anything a reviewer could mistake for a requirement does.

## What counts as human evidence

Only substantive information a human typed. Approving or delegating a choice is not stating one, so a decision made under `"go with your recommendation"` stays an agent decision, recorded with `prov decide --delegated`.

`prov human` refuses approval-only quotes outright: `yes`, `proceed`, `sounds good`, `do whatever you think is best`, `your call`, and the rest. It matches word by word against a vocabulary, which will always miss a phrasing, so it also refuses a quote carrying fewer than two words of its own — approval is short, and a phrasing the vocabulary has never heard of runs out of content words instead of slipping through. Add a word to the vocabulary when you meet one; a missing word is not a hole.

Refused, and the human really did state something? Quote more of what they wrote. The two mistakes cost differently: a refusal costs one retry, while a recorded approval leaves an agent's own choice standing as a requirement that nobody can edit out.

These create human evidence:

```
use SQLite, not Postgres
this must work offline
clicking X sometimes deletes Y
don't change the keyboard behaviour
```

Quote what the human wrote, unedited, including the typos. Summarising is already interpretation, and interpretation belongs in a decision.

A human who changes their mind produces a new record: `prov human <change> --supersedes <old-id>`. The old record keeps printing, marked `(superseded by pv_...)`, because a withdrawn requirement that reads like a live one is worse than no record at all. Editing or deleting a committed human record fails `prov lint`, because a store you can quietly rewrite answers nothing. Restoring the original text clears it: the check compares the file against the bytes first committed, so an accident is undoable and only a live difference is a problem. The current requirements are what you get by reading the evidence in order, not a document someone maintains.

## Reading provenance

```bash
bun run prov context server/src/forum/forum.service.ts      # or path:140, path:140-190
bun run prov review main..HEAD
bun run prov show 01a0641b                                  # any id prefix
bun run prov lint
```

`context` answers two different questions at once. **Applies now** comes from `components.yaml`: every decision scoped to a component whose globs cover this path, and the human evidence behind those decisions. A requirement outlives the lines it arrived with, so scoping it through the decisions it produced keeps it in the answer once the code has been rewritten around it and blame no longer reaches the commit that carried it. **History** blames the lines, follows each commit's trailer to its change, and prints the human quotes and decisions behind it, once per change however many commits it spans. The path can be written any way you have it, absolute or relative to wherever you are standing.

`review` is the one to run before critiquing a diff. It separates the human requirements in the range from the decisions an implementer made, so `D1 is broader than H1 needs` stays available as a criticism instead of reading as an attack on a requirement. It also lists commits in the range carrying no trailer, skipping the ones that predate the baseline, names any trailer pointing at a change the store does not hold, and lists the files of those same commits rather than a two-dot diff against a base branch that has since moved on. A broken link has to read as a broken link, not as "nothing was recorded".

## Moves, deletes, and code older than the store

A record saying a change touched `src/foo.ts` was true when it was written. Moving the file does not make it false, so leave it alone. Repoint the glob in `components.yaml` instead: one edit, and every scoped decision follows the code. A move that genuinely splits a responsibility is a new decision that supersedes the old one.

Deleted code keeps its provenance. Why something was removed is worth as much as why it was added.

Everything at or before the commit in `baseline.yaml` reports as predating the store. Nothing was backfilled. When you work out why some legacy behaviour exists, record it with `prov note "..." --component server --confidence medium`, which is a reconstruction: an agent's reading of existing code, marked as such. Code implying somebody once wanted something is not evidence that they did. Find the sentence they actually wrote, and it becomes a human record.

## The files

```
.provenance/
├── SPEC.md
├── baseline.yaml      where the store starts
├── components.yaml    component -> globs. Agent-owned, mutable, repointed when code moves
├── human/pv_*.yaml    id, kind, created_at, change, source, supersedes, quote
├── decisions/pv_*.yaml
└── changes/pv_*.yaml  id, kind, created_at, title
```

A decision is `summary`, `authority` (`delegated-discretion` or `agent-judgment`), `applies_to`, `supersedes`, optional `detail`. A reconstruction sits in the same directory with `confidence` in place of `authority`, and its `change` is optional because legacy behaviour rarely belongs to a task.

Every record names its change; a change lists nothing. Two agents recording at once therefore each write one new file, where appending to a list in the change record would keep only the last write. Order comes from the ids.

Ids are `pv_` plus a UUIDv7, so every worktree mints its own without a shared counter and without merge conflicts. Git history is the real order; the timestamp in the id is a convenience. Any command takes an unambiguous id prefix.

`prov lint` checks the schemas, dangling and mis-kinded references, unknown components, and every human record the history ever held against the bytes it was first committed with — a committed deletion is already gone from `HEAD`, which is exactly the tamper worth catching. It re-checks quotes only where they are still uncommitted and the author can still fix them; judging a frozen record by a vocabulary that has grown since would fail the build over a record nobody is allowed to edit. CI runs it on every pull request, so a file in `human/` rewritten or removed by hand fails the build rather than the honour system. Prettier does not touch `human/` for the same reason.
