---
name: spec
description: Interview me about a feature until nothing is ambiguous, then write the spec into a provenance directory.
disable-model-invocation: true
---

# Spec

Your task is to interview the user and eventually reach a spec regarding a user-specified design. Write no code until the user asks for implementation.

Read the code the feature touches. Every question you ask should be a choice the code can't answer.

## Interview

Interview the user on the feature: behavior, states, edge cases and failure states, who can do it, which apps it lands in, data and migrations, what's out of scope. Ask in plain text, without tool calls.

Complete an ambiguity pass before asking anything. Collect every implementation-changing question you can identify, then ask them together in one numbered message.

Done when every question is settled, and you can't name an open question whose answer would change the implementation.

### Guidelines

Don't assume the answer to any question. If anything is unclear, ask the user.

## Documentation

After the interview, read and follow `(root)/skills/provenance/SKILL.md`, and create a new directory in `docs/provenance`. As a sanity check, if the interview was done correctly, `DECISIONS.md` should have no content. If you are tempted to populate `DECISIONS.md`, instead, ask the user another round of questions.
