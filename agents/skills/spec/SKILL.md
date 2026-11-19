---
name: spec
description: Read when the user asks to spec or plan a change before building it. Interview them until nothing is ambiguous, then write the spec into a provenance directory.
---

# Spec

The deliverable is a spec, not code: write none until the user asks for implementation. Interview the user about the change they name until you can't name an open question whose answer would change the implementation, then record the result.

Read the code first, so you ask only what it can't answer. Ask in rounds per root `AGENTS.md` **Open questions**, since answers open new decisions. Gaps worth checking: behavior, states, edge and failure cases, who can do it, which apps it lands in, data and migrations, and what's out of scope.

Record the result in a new provenance directory per `(root)/agents/skills/provenance/SKILL.md`.
