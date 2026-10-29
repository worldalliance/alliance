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

Read the codebase first: every question you ask is a choice the code can't answer. Collect every question whose answer would change the implementation. Assume no answer; if anything is unclear, ask.

Ask every question in one numbered plain-text message, not a structured question tool. Give each question lettered options: your recommendation first, then alternatives, then "I don't care". Picking the recommendation makes it an agent-proposed, user-approved requirement; "I don't care" leaves it a deferred choice, per `(root)/skills/provenance/SKILL.md`. Open each message by telling the user that difference: the recommendation becomes a requirement later agents must keep, while "I don't care" lets the agent decide and switch to something else if its pick causes friction.

Continue asking as answers uncover more decision points. Done when every question is settled, and you can't name an open question whose answer would change the implementation.

## Documentation

After the interview, read and follow `(root)/skills/provenance/SKILL.md`, and create a new directory in `docs/provenance` and populate its files, separating what was suggested by the user from what was only agreed to.
