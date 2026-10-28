---
name: wiki
description: Read before answering how the repository behaves, changing code, adding a provenance directory, or auditing the wiki.
---

# Wiki

`docs/wiki/` explains current behavior, one topic per page. `docs/wiki/index.md` lists every page under a group; `docs/wiki/coverage.md` has one row per `docs/provenance` directory, with its dispositions defined at the top. Intent and rationale stay in provenance, linked from the pages.

## Find

Read the index, then the relevant pages, then the code, tests, and provenance they link. Pages point at sources and don't replace them: confirm a claim in its source before relying on it.

## Change with the code

In any change to code or provenance, before handing off:

- Search `docs/wiki/` for links to each file you changed, and re-point every line range the edit moved. Citations are relative links, with code cited as `path#L<n>-L<m>`; `wikicheck` catches a range past the end of a file, not one that drifted.
- Every page explaining behavior you changed says what the code now does.
- A distinct new concept with no page yet waits for the initial content pass, which writes pages in reviewed batches; its record's `pending` row queues it. Whoever writes a page gives it a stable, descriptive filename, opens it with a `# Title` and the behavior, and adds it to the index as `- [Title](page.md) — description` under a `## Group` heading. Explain the current state; task history stays in provenance.
- A renamed page or heading breaks every link to it: update the referrers in the same change.
- Each provenance record this change creates gets a coverage row: `current` with Topics when its behavior lands on pages this change updates, `implementation-only` or `unimplemented` with Notes when the record is internals only or not yet built, otherwise `pending`. A record this change builds on keeps its row's dispositions matching the code, per the definitions atop `docs/wiki/coverage.md`; a row whose behavior now needs a page that doesn't exist yet returns to `pending`, and a `pending` row stays `pending`, adding to its Topics any page this change writes or updates that explains part of the record: synthesizing a record, which means writing its pages and then replacing `pending` with matching dispositions, happens in the initial content pass or when the user asks for it.
- Behavior the user's current request deliberately replaces: set `superseded` on each earlier record's row, with Notes citing the new record. It replaces `current` or `pending` only when the whole record is replaced; otherwise `current` gains `superseded`, and `pending` stays, with that Note. The request settles that disagreement, so it is not a **conflict**.

Keep three claims distinguishable: observed implementation, explicit requirements, and inferred intent. Describe what code does without presenting it as a requirement. For an origin nothing records, follow `git blame` through moves to the introducing commit, then its message and linked PR; cite the commit and label the rationale git-derived. A commit author is Git attribution, not proof of who asked for the behavior.

## Conflict

Requirements and code disagree in a way the user's current request doesn't settle, or a claim that a requirement was superseded or never built is uncertain: leave that topic's explanation unchanged, mark its coverage row `blocked`, which replaces `pending` and joins any other disposition, with the question in Notes, and ask the user, quoting the conflicting passages and code. A newer record alone doesn't supersede an older one, and code that differs from a requirement doesn't prove the requirement was dropped. Continue unrelated topics.

## Audit

On request, for the whole wiki or the scope named:

1. Check every claim and citation on each page against the code and linked provenance, and each coverage row against its records.
2. Fix verified documentation errors: stale citations, explanations that misdescribe code still meeting its requirements, and coverage rows whose dispositions or topics no longer match. Application code and requirements stay as they are.
3. Handle each requirements/code disagreement as a **conflict**.
4. Report the edits made, the rows marked `blocked` with their questions, and unavailable links found in provenance documents.

## Done

`bun run wikicheck` passes. It checks structure only; accuracy rests on your reading of the sources.
