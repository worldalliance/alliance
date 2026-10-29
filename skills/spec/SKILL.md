---
name: spec
description: Interview me about a feature until nothing is ambiguous, then write the spec into a provenance directory.
disable-model-invocation: true
---

# Spec

Your task is to interview the user and eventually reach a spec regarding a user-specified design. Write no code until the user asks for implementation.

## Interview

Interview the user on the feature, asking per **Open questions**: behavior, states, edge cases and failure states, who can do it, which apps it lands in, data and migrations, what's out of scope, any other questions you think of.

## Open questions

Read the codebase first, then collect every question whose answer would change the implementation. Assume no answer; if anything is unclear, ask, in the format of **Open questions** in the root `AGENTS.md`.

Done when every question is settled, and you can't name an open question whose answer would change the implementation.

## Documentation

After the interview, read and follow `(root)/skills/provenance/SKILL.md`, and create a new directory in `docs/provenance` and populate its files, separating what was suggested by the user from what was only agreed to.
