---
name: consult
description: Read before asking the user a question in the root AGENTS.md Open questions format. A step-back brainstormer and a researcher look at the problem before the questions are drafted, a second opinion judges the draft last, and every option names its source.
---

# Consult

Before a set of questions in the root `AGENTS.md` **Open questions** format reaches the user, other agents widen and check it. Other questions, permission asks and `AskUserQuestion` interviews included, skip this, and an agent that returns its questions to another agent, such as a review-loop fixer, leaves it to the agent that asks the user. Spawn per `(root)/agents/skills/subagents/SKILL.md`.

A fact only the user knows, such as how they work, goes to them first, without agents: no agent can recover it, and unanimous agents have been wrong for lack of one.

1. **Step back.** Before drafting, a brainstormer gets the situation and the goal behind the request, not your framing of the questions, and suggests many varied ideas, bad ones welcome: what problem is worth solving, what lies past the request (root `AGENTS.md` **The problem behind the request**), what nobody mentioned. Alongside it, a researcher looks up the established practice for the decision, insofar as any exists.
2. **Draft** the questions and options from what they found.
3. **Second opinion, last**, from the other vendor's model: it challenges the framing, judges the draft and both reports, and gives its own view. Having seen the others' work, it is a critic, not independent confirmation.

Each new set of questions gets its own round, since the agents cover only what they saw.

Every option, the recommendation included, names what backs it in words the user can follow without having seen the agents' reports: research, with its root `AGENTS.md` **Established practice** category and link, the user's earlier words, or agent judgement, saying whose: the brainstormer's, the second opinion's or yours. Say what the round changed, name any agent that failed with its error, and show a disagreement with the claim each side rests on instead of spawning agents until they agree.
