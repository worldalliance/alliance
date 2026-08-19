---
name: context-files
description: Read before writing or editing SKILL.md, AGENTS.md, or CLAUDE.md.
---

Every token here competes with code the agent came to read. "Why use many token when few do trick?"

## Where rule goes

- Always true subtree-wide → nearest `AGENTS.md`. Root one loads every turn: rules, not procedures
- Only for one kind of task → skill. `description` is trigger, and only always-loaded part: "Read <when it's needed>", globs or action, nothing else. Reading it explains itself.
- Skills auto-load in Claude only — other agents read `AGENTS.md` alone. Every skill also needs a one-line pointer from nearest `AGENTS.md`.

## Voice

Telegraphic. Drop articles, hedges, transitions, any sentence that only introduces the next. Cut until more would make it ambiguous. This file does that.

## What earns space

Only what agents often get wrong or burn turns on without it:

- Values they can't derive — ports, bundle ids, credential locations, paths grep won't surface.
- Failure → cause: "red screen, native binding not a function → installed build predates native dep change; rebuild with X."
- Choices whose right answer looks wrong, plus one clause that stops agents "fixing" it.

Leave out — if you can infer it, future agents can too:

- Anything one `grep`/`ls`/`--help` away — SQL against named tables, where routes live, standard CLI flags.
- How it works, when action is unchanged either way.
- Same fact twice in one file: inline value _and_ pointer to file defining it, or restated a section later. Pick one. Across files is fine — reader may see only one.
- Change history, reorg rationale.
- Spelled-out recipes. "Postgres creds in `server/.env`" beats a psql tutorial. Name tool, not incantation.
- Wrapper scripts for CLIs agents can call directly.

Put paths in commands (eg `~/.maestro/bin/maestro test`), not prose about them.

## Sizing

Cut sentences, not syntax — `\n` × 10, `##`, `######`, and `**` are each still 1 token. Count with `gpt-tokenizer`.
