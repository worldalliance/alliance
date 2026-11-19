# Evidence

## Incident: review rounds on this PR

Observed 2026-11-19 by reading the review-loop ledger and diffs of this task's first two commits (PR #1042, branch `agents-production-order-linear-claim`), with the review-loop skill as of `47d5319d82`. Ten review rounds each found a true edge case in two short instructions. The fixer, whose `drop` covers only incorrect findings, made each one fix-now and added a clause each time, until the user judged the text too specific.

## Research: how specific should agent instructions be

Question: what vendor guidance and research say about covering edge cases in agent instructions versus leaving them to the model. Checked 2026-11-19 by a research subagent; most quotes were read through a summarising fetch, so they are paraphrased here.

- Anthropic, Skill authoring best practices (vendor recommendation): assume Claude is already capable and add only context it lacks; match specificity to how fragile the task is; write minimal instructions addressing gaps observed in evaluation rather than anticipated ones. https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Anthropic, Effective context engineering for AI agents (vendor recommendation): recommends against stuffing a laundry list of edge cases into a prompt; prefer canonical examples and the minimal set of information that outlines the expected behaviour. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic, Best practices for Claude Code (vendor recommendation): keep CLAUDE.md short, write down only what Claude can't find on its own; rules with no exceptions belong in hooks. https://code.claude.com/docs/en/best-practices
- IFScale (research, NeurIPS 2025): instruction-following accuracy falls as the number of instructions grows, mostly through omissions. https://arxiv.org/abs/2507.11538
- SkillsBench (research, single benchmark): focused skills outperform comprehensive documentation. https://arxiv.org/abs/2602.12670
- Google code review guide (common practice): reviewers guard against over-engineering, solving the problem known now rather than speculative ones. https://google.github.io/eng-practices/review/reviewer/looking-for.html
