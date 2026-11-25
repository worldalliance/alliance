---
user: Charles Lien
task: Review how the "spawn three agents before asking me any question" prompt worked across recent chats, then make it a standing rule.
---

# Requirements

- Before asking the user a question the rule covers, the agent consults three agents: a brainstormer, a research agent that looks up the industry standard insofar as one exists, and a second opinion agent that gives an additional, varied view. (user-originated)
- The brainstormer's role is to take a step back and widen the thinking: question what problem is worth solving, consider what wasn't explicitly mentioned, and look at alternatives at larger scales, such as making the thing automatic or fixing a broken larger system. It gets a deliberately loose brief so as not to limit its ideas, and bad ideas are welcome. (user-originated)
- The brainstormer runs before the questions are drafted, on the situation and the goal rather than the agent's framing of the questions. (agent-proposed, user-approved)
- The second opinion runs last: it judges the draft and the other agents' reports and challenges the framing. There is no separate judge. (user-originated; dropping the judge agent-proposed, user-approved)
- The skill states each role's purpose and leaves the method to the agent's judgement, keeping only facts an agent can't derive. (agent-proposed, user-approved)
- The consult agents' tools are left to the agent spawning them, as for any subagent; this PR adds no tool restrictions. (agent-proposed, user-approved)
- Root `AGENTS.md` carries a general principle: name the problem behind a request and look past it to alternatives at larger scales, raise a materially better alternative before expanding the work, brief subagents and write skills with purpose, context and constraints rather than steps, and bring in a subagent or the user when uncertain or stuck. (agent-proposed, user-approved)
- Each option offered to the user is annotated with its source. (user-originated)
- The rule covers later questions as well as the first, and holds without the user pasting it into each chat. (user-originated)
- `agents/skills/writing-for-agents/SKILL.md` is replaced by a short brief: explain the purpose and supply missing context, state real constraints and what success looks like, leave the method open unless order matters, keep corrections-replace, references behind pointers and pruning, and keep the verified facts about how Claude and Codex load skills. Text kept from the MIT-licensed upstream it was forked from would carry that licence's notice. (agent-proposed, user-approved)
- Before switching, the current guide, the short brief and no guide are compared on real skill-writing tasks, judging results and needless process. (agent-proposed, user-approved)
- The skills written under the old guide are reviewed in a follow-up: read transcripts for where each was misread, ignored or over-followed, and trim against the new principle. It is tracked as a Linear issue, filed once this PR has finished review. (agent-proposed, user-approved; filing order user-originated)
- The guide replacement ships in this PR. (user-originated)
