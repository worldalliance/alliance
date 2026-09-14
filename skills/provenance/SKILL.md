---
name: provenance
description: Read before implementing a feature or behavior change.
---

# Provenance

These files let a reviewer tell what the user asked for from what the agent decided while implementing. Create them at the start of a task and update them as it runs.

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

Open with frontmatter naming the user and the task. Use `git config user.name` for the user field.

Only what the user actually said: requirements, constraints, preferences, selections, clarifications. Copy or closely paraphrase only the minimum text needed to preserve meaning.

Each entry must make sense without the task transcript. When the user refers to a proposal, finding, numbered step, or other shorthand, include the part needed to interpret the statement and label who wrote it. User approval does not turn agent-authored context into human-origin information.

Replace every credential or secret with `[redacted]`. Do the same for personal information unrelated to the requirement.

Never infer user intent from existing code, prior agent decisions, or agent proposals; existing code proves only that the behavior existed.

## DECISIONS.md

Decisions, assumptions, interpretations, and implementation choices made by agents, each with its rationale. These are not authoritative merely for existing; a later agent may reconsider them unless REQUIREMENTS.md or an external requirement constrains them.

## Unclear provenance

Record it as unknown rather than guessing. Delegation is not origin: if the agent proposes PostgreSQL and the user says something similar to "go with your recommendation" or "yes", the approval belongs in REQUIREMENTS.md and the choice of PostgreSQL in DECISIONS.md. "Use PostgreSQL" puts it in REQUIREMENTS.md. Existing code using PostgreSQL is evidence of nothing on its own.
