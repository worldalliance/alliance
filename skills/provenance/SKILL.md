---
name: provenance
description: Read before implementing a feature or behavior change.
---

# Provenance

These files hold the current requirements and agent decisions, with their origins distinguished. Create them at the start of a task and revise them in place as requirements change.

## When

Applies when implementing a feature or changing behavior, any task where the change will outrun what the user described. Skip it for trivial fixes, chores, and refactors whose diff matches the request; over-applying is cheap, skipping is the failure mode. A refactor bundled into a feature task still gets a directory.

## Layout

```bash
FEATURE_NAME="<kebab-case-name>"
UUID_V7=$(bun -e 'console.log(Bun.randomUUIDv7())')
mkdir -p "docs/provenance/${UUID_V7}-${FEATURE_NAME}"
```

UUIDv7 makes directory listings sort by creation time. Inside, two files: `REQUIREMENTS.md` and `DECISIONS.md`. These are intended to live in the repo.

## REQUIREMENTS.md

Open with frontmatter naming the user and the task. Use `git config user.name` for the user field. Do not redact this field.

State the current user requirements, constraints, preferences, and approved selections directly. Incorporate clarifications into the affected entries and remove superseded requirements. Keep conversation history, approval quotes, and interview question numbers out of the files.

Make each requirement self-contained: expand shorthand and include the exact behavior, values, and message copy needed to implement it. Omit references to unavailable attachments or the task transcript. Accessible supporting links may supplement the requirements.

Distinguish user-originated requirements from agent-proposed, user-approved selections with concise origin labels. Origin is metadata, not a narrative of how the requirement was negotiated.

Replace every credential or secret with `[redacted]`. Do the same for personal information unrelated to the requirement. Do not redact the user frontmatter field.

Never infer user intent from existing code, prior agent decisions, or agent proposals; existing code proves only that the behavior existed.

## DECISIONS.md

State current agent decisions, assumptions, interpretations, and implementation choices, each with its rationale. Replace superseded choices in place. Reference requirements rather than duplicating them. These decisions are not authoritative merely for existing; a later agent may reconsider them within the constraints in REQUIREMENTS.md.

## Unclear provenance

Record unknown origins explicitly. Approval makes an agent proposal an approved requirement, not a user-originated idea. For example, an approved agent recommendation to use PostgreSQL is a direct requirement labeled agent-proposed and user-approved; the implementation rationale belongs in DECISIONS.md.
