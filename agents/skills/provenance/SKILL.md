---
name: provenance
description: Read before making a repository change intended to be kept, or determining the provenance of anything in the repository.
---

# Provenance

A task's files hold its requirements, agent decisions and the research behind them as they stood when it was implemented, with their origins distinguished. They record that task, not the repository's current rules. Create `REQUIREMENTS.md` at the start of a task and revise its files in place as its requirements change while it is in progress, as **When** defines. A later task leaves an earlier task's files as written: where it changes one of their requirements or decisions, it records the new one in its own files, naming the earlier task's directory it supersedes. Its one edit to them replaces secrets or incidental personal information with `[redacted]`, because the repository is open source; the root `AGENTS.md` **Secrets and personal information** says what that covers. Before relying on a task's files, search `docs/provenance` for its directory name to find later tasks that supersede them. Where an `AGENTS.md` or skill rule added or changed after a task conflicts with one of its entries, the rule wins.

## When

Every repository change intended to be kept gets a directory, however small: code, tests, config, scripts, docs, and skills. Create it before editing, even when committing has not been requested. Temporary experiments and working files need none. Each PR is its own task. A change continuing a task whose directory is not yet on `main` revises that directory instead. `main` squash-merges, so a branch's commits never land on it: a PR has merged once its directory is on `main` (`git fetch -q origin main && { git cat-file -e FETCH_HEAD:docs/provenance/<task-dir> 2>/dev/null && echo merged || echo unmerged; }`). The next PR of a plan gets its own directory naming the earlier one, even while that one is unmerged. A change that only redacts earlier tasks' provenance needs none.

## Layout

```bash
FEATURE_NAME="<kebab-case-name>"
UUID_V7=$(bun -e 'console.log(Bun.randomUUIDv7())')
mkdir -p "docs/provenance/${UUID_V7}-${FEATURE_NAME}"
```

UUIDv7 makes directory listings sort by creation time. Inside, `REQUIREMENTS.md` and `SESSIONS.md`, plus `DECISIONS.md` when the task made a choice or recorded an assumption worth keeping, and `EVIDENCE.md` when it researched sources outside the repository or a decision rests on its own measurements, incidents or experiments. These are intended to live in the repo.

References flow one way: `DECISIONS.md` may reference `REQUIREMENTS.md` and `EVIDENCE.md`; `REQUIREMENTS.md` never references `DECISIONS.md` or rests on `EVIDENCE.md`'s findings, and the research and measurements in `EVIDENCE.md` reference neither file.

## REQUIREMENTS.md

Open with frontmatter naming the user and the task as the user set it. Use `git config user.name` for the user field. Do not redact this field.

State the task's user requirements, constraints, preferences, and approved selections directly. For a fix, refactor, or chore that does only what the user asked in their own words, restating that request as a requirement or two is sufficient. Incorporate clarifications into the affected entries and remove requirements the user superseded during the task. Keep conversation history, approval quotes, and interview question numbers out of the files.

Make each requirement self-contained: expand shorthand and include the exact behavior, values, and message copy needed to implement it. Omit references to unavailable attachments or the task transcript. Accessible supporting links may supplement the requirements.

This file holds only requirements the user stated or approved, each with a concise origin label: user-originated, or user-approved with the proposal's source. For example, an approved agent recommendation to use PostgreSQL is a direct requirement labeled agent-proposed and user-approved; the implementation rationale belongs in DECISIONS.md. Origin is metadata, not a narrative of how the requirement was negotiated. A requirement the user made optional or conditional ("only if it's easy") keeps that condition in its entry.

Material the user hands over as the task, such as a forwarded email, a pasted agent note, or a Linear issue, is a set of proposals. Ask the user about each of its points, per root `AGENTS.md` **Open questions**; an agent that cannot reach the user returns the questions in its report for the agent that can. Points the user approves go here, and so does a point the user rejects, as a user-originated requirement against it; the rest go in DECISIONS.md.

Replace every credential or secret with `[redacted]`. Do the same for personal information unrelated to the requirement. Do not redact the user frontmatter field.

## DECISIONS.md

State the task's agent decisions, assumptions, interpretations, and implementation choices, each with its rationale. Replace choices superseded during the task in place. Reference requirements rather than duplicating them. These decisions are not authoritative merely for existing; a later agent may reconsider them within the constraints in REQUIREMENTS.md, recording its new choice in its own task's files.

A choice the user defers ("I don't know", "I don't care", "it doesn't matter", or the like) is the agent's, not a requirement: record the recommendation here, and drop it for an alternative once it adds more friction than it's worth. Say whether the user deferred whether the work happens or how it is done; work whose existence the user left open is optional.

Behavior the task records without the user's approval, such as behavior in existing code, prior agent decisions, or unapproved proposals, goes here as an assumption. Label its origin (agent proposal, agent decision, reconstructed from existing code, the forwarded source), or `unrecorded` when unknown. Existing code proves only that the behavior existed, not that the user asked for it.

## EVIDENCE.md

The task's research into sources outside the repository, such as standards, documentation and studies, whoever did it, a subagent's report included: the question, the findings with a source link for each claim, each source's status per root `AGENTS.md` **Established practice**, and the date it was checked. Measurements, incidents and experiments a decision rests on, such as how a dependency behaves or what the repository's own code does, go in a section of their own, each with its method, the versions involved and the date. `DECISIONS.md` cites its sections instead of restating them. Revise it in place when research is redone, so it holds current findings only. Checks that only verify the task's own change go in the handoff, per `(root)/agents/skills/implement/SKILL.md`; a run of the change that a decision rests on is an experiment and stays here. An `EVIDENCE.md` that already holds something else, such as a log of the checks its task ran or a reference to `DECISIONS.md`, keeps it; add research to it under its own heading.

## SESSIONS.md

One bullet per agent session that changed the repository for the task, code included. Before a session first makes such a change, including a session continuing an existing task, it adds its own bullet unless one is already there:

```bash
line="- claude:${CLAUDE_CODE_SESSION_ID:?}"   # Codex: line="- codex:${CODEX_THREAD_ID:?}"
f=docs/provenance/<task-dir>/SESSIONS.md
grep -qxF -- "$line" "$f" 2>/dev/null || echo "$line" >> "$f"
```

Run the check your CLI's session-start hook runs as well. Codex's hooks run the main checkout's script, even from a worktree:

```bash
bun "$(git rev-parse --show-toplevel)/agents/chats/chats.ts" check   # Codex: bun "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/agents/chats/chats.ts" check
```

When it says uploads are not working, or the script is missing, tell the user that this session's transcript is not being stored and that `agents/README.md` has the setup, then carry on.

This list is the link from a task to its transcripts; commits carry none. `.gitattributes` merges these files by union, so appends from two branches don't conflict.

## Transcripts

Hooks in `.claude/settings.json` and `.codex/hooks.json` upload every session's raw transcript to the private `alliance-agent-chats` bucket at `<tool>/<session>.jsonl`, a subagent's at `<tool>/<session>/<file>`. Read one when the files here are wrong or thin:

```bash
bun agents/chats/chats.ts fetch claude/<uuid>.jsonl > .scratch/<uuid>.jsonl
```

A transcript runs to megabytes of JSON lines, so read it through `jq` filters written for the question at hand, such as the user turns alone, never whole. Claude lines with `.type` of `user` or `assistant` hold the text in `.message.content`; Codex lines with `.type` of `response_item` hold it in `.payload`.
