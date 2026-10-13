---
name: spec
description: Interview me about a feature until nothing is ambiguous, then write the spec into a provenance directory.
disable-model-invocation: true
---

# Spec

Your task is to interview the user and eventually reach a spec regarding a user-specified design. Write no code until the user asks for implementation.

You may read the files in the codebase. Every question you ask should be a choice the code can't answer.

## Interview

Interview the user on the feature: behavior, states, edge cases and failure states, who can do it, which apps it lands in, data and migrations, what's out of scope, any other questions you think of.

Collect every implementation-changing question you can identify.

Continue asking questions as more decision points are uncovered. Done when every question is settled, and you can't name an open question whose answer would change the implementation.

### Format

Ask with the structured question tool (`AskUserQuestion` in Claude Code, `ask_user_input_v0` on claude.ai), batching as many questions per call as it allows. Make your recommendation the first option of each question.

With no such tool available, ask in one numbered plain-text message, with your recommendation beside each question.

### Guidelines

Don't assume the answer to any question. If anything is unclear, ask the user.

## Documentation

After the interview, read and follow `(root)/skills/provenance/SKILL.md`, and create a new directory in `docs/provenance` and populate `REQUIREMENTS` and `DECISIONS`, separating what was suggested by the user and what was only agreed to.
