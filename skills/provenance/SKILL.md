---
name: provenance
description: Read before implementing a feature or behavior change.
---

# Provenance

These files separate what the user asked for, what was observed, and what the agent decided while implementing. Create them at the start of a task and update them as it runs.

## When

Applies when implementing a feature or changing behavior, any task where the change will outrun what the user described. Skip it for trivial fixes, chores, and refactors whose diff matches the request; over-applying is cheap, skipping is the failure mode. A refactor bundled into a feature task still gets a directory.

## Layout

```bash
FEATURE_NAME="<kebab-case-name>"
UUID_V7=$(bun -e 'console.log(Bun.randomUUIDv7())')
mkdir -p "docs/provenance/${UUID_V7}-${FEATURE_NAME}"
```

UUIDv7 makes directory listings sort by creation time. Inside, three files: `REQUIREMENTS.md`, `EVIDENCE.md`, and `DECISIONS.md`. These are intended to live in the repo.

## REQUIREMENTS.md

Open with frontmatter naming the user and the task. Use `git config user.name` for the user field.

Only what the user actually said: requirements, constraints, preferences, selections, clarifications. Copy or closely paraphrase only the minimum text needed to preserve meaning.

Each entry must make sense without the task transcript. When the user refers to a proposal, finding, numbered step, or other shorthand, include the part needed to interpret the statement and label who wrote it. User approval does not turn agent-authored context into human-origin information.

Replace every credential or secret with `[redacted]`. Do the same for personal information unrelated to the requirement.

Never infer user intent from existing code, prior agent decisions, or agent proposals; existing code proves only that the behavior existed.

## EVIDENCE.md

Only objective observations, each paired with how it was obtained and the result. It should be reproducable like a chemistry lab report. For issues that are not reproducable, you may add a timestamp and just make a note.

- For commands, record the commit/codebase state, command, working directory, exit status, and observed output.
- For other methods, record the source or steps and what was observed. Include the revision, inputs, or environment details needed to reproduce or locate the observation, subject to the repo-wide redaction rule in `AGENTS.md`.

No narrative context: explanations, hypotheses, interpretations, rationale, and conclusions belong in `DECISIONS.md`. `EVIDENCE.md` must stand alone for a reviewer who never reads `DECISIONS.md`. Neither reference nor paraphrase that file; obtain each fact directly from its source. Use neutral headings and descriptions that do not reveal agent decisions.

Record failed checks and observations that contradict the chosen approach alongside other results. Keep claims within what was observed: a command exiting successfully establishes that result, not the correctness of the implementation.

Before handing off, check that every entry has a source or acquisition method and an observed result, and can be understood and verified without `DECISIONS.md`.

## DECISIONS.md

Decisions, assumptions, interpretations, and implementation choices made by agents, each with its rationale. These are not authoritative merely for existing; a later agent may reconsider them unless REQUIREMENTS.md or an external requirement constrains them.

## Unclear provenance

Record it as unknown rather than guessing. Delegation is not origin: if the agent proposes PostgreSQL and the user says something similar to "go with your recommendation" or "yes", the approval belongs in REQUIREMENTS.md and the choice of PostgreSQL in DECISIONS.md. "Use PostgreSQL" puts it in REQUIREMENTS.md. Existing code using PostgreSQL can be recorded with its source in EVIDENCE.md; it establishes usage, not user intent or rationale.
