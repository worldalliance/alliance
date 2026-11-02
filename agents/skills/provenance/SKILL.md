---
name: provenance
description: Read before making a repository change intended to be kept, or determining the provenance of anything in the repository.
---

# Provenance

These files hold the current requirements and agent decisions, with their origins distinguished. Create `REQUIREMENTS.md` at the start of a task and revise the files in place as requirements change.

## When

Every repository change intended to be kept gets a directory, however small: code, tests, config, scripts, docs, and skills. Create it before editing, even when committing has not been requested. Temporary experiments and working files need none. A change continuing an existing task revises that task's directory instead. A change touching only `docs/provenance/` needs none.

## Layout

```bash
FEATURE_NAME="<kebab-case-name>"
UUID_V7=$(bun -e 'console.log(Bun.randomUUIDv7())')
mkdir -p "docs/provenance/${UUID_V7}-${FEATURE_NAME}"
```

UUIDv7 makes directory listings sort by creation time. Inside, `REQUIREMENTS.md`, plus `DECISIONS.md` when the task made a choice whose rationale is worth keeping. These are intended to live in the repo.

References flow one way: `DECISIONS.md` may reference `REQUIREMENTS.md`; `REQUIREMENTS.md` stands independently and never references `DECISIONS.md`.

## REQUIREMENTS.md

Open with frontmatter naming the user and the task. Use `git config user.name` for the user field. Do not redact this field.

State the current user requirements, constraints, preferences, and approved selections directly. For a fix, refactor, or chore that does only what the user asked, restating the request as a requirement or two is sufficient. Incorporate clarifications into the affected entries and remove superseded requirements. Keep conversation history, approval quotes, and interview question numbers out of the files.

Make each requirement self-contained: expand shorthand and include the exact behavior, values, and message copy needed to implement it. Omit references to unavailable attachments or the task transcript. Accessible supporting links may supplement the requirements.

Distinguish user-originated requirements from agent-proposed, user-approved selections with concise origin labels. Origin is metadata, not a narrative of how the requirement was negotiated.

Replace every credential or secret with `[redacted]`. Do the same for personal information unrelated to the requirement. Do not redact the user frontmatter field.

Never infer user intent from existing code, prior agent decisions, or agent proposals; existing code proves only that the behavior existed.

## DECISIONS.md

State current agent decisions, assumptions, interpretations, and implementation choices, each with its rationale. Replace superseded choices in place. Reference requirements rather than duplicating them. These decisions are not authoritative merely for existing; a later agent may reconsider them within the constraints in REQUIREMENTS.md.

A choice the user defers ("I don't know", "I don't care", "it doesn't matter", or the like) is the agent's, not a requirement: record the recommendation here, and drop it for an alternative once it adds more friction than it's worth.

## Unclear provenance

Record unknown origins explicitly. Approval makes an agent proposal an approved requirement, not a user-originated idea. For example, an approved agent recommendation to use PostgreSQL is a direct requirement labeled agent-proposed and user-approved; the implementation rationale belongs in DECISIONS.md.
