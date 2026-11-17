# Evidence

Checked 17 November 2026.

## Audit of the prompt in use

Method: 11 Claude Code chats from 16–17 November where the user pasted or paraphrased the prompt, found by searching local transcripts and the `alliance-agent-chats` bucket (no bucket-only transcript contained it). Each was condensed to user turns, assistant text and spawn prompts, and audited by three subagents against one checklist; a Codex review then challenged the audits. The chats ran Claude Code 2.1.325–2.1.326 and Codex CLI 0.167.0.

- In about 9 of 11 chats the prompt arrived after a question had already gone out; nothing carried it across sessions, and one handoff recorded a rule against spawning the agents.
- One round per topic let later questions go out unbacked (domain, desktop); one product question went unbacked for two hours. The user enforced the rule by hand at least four times.
- Source annotation appeared when the paste asked for it and was missing otherwise; the user asked for it at least four times. A parent's own pick was once read as agent-backed.
- The brainstormer returned 20–38 ideas per round; in about 30 answered questions the only pick plausibly from it alone was a drift-check requirement. The SMS send-time collision check reached the options from its list, also backed by the other agents.
- The second opinion (usually Codex) changed recommendations in about six chats and found real defects, such as a duplicate-send path and nginx not enabled at boot.
- Research cited real standards and vendor docs and reported when none existed.
- Typical round: 2–8 minutes, 3 spawns; with tie-breakers, 28 minutes and 12 spawns. Unanimous agents backed a ruleset the user's cherry-pick-and-force-push habit overturned.
- A `claude -p` researcher without skipped permissions had no web access; one parent described a Codex run as read-only when it ran with the sandbox bypassed.

## Research

Questions: where a standing rule for agents belongs; whether independent views before aggregation and a separate judge improve the decision; whether source tagging has a standard.

Status labels follow the root AGENTS.md **Established practice** categories.

- Vendor recommendation: CLAUDE.md holds always-on rules, under 200 lines, and procedures belong in skills that load on use (https://code.claude.com/docs/en/claude-md, https://code.claude.com/docs/en/skills). Codex: AGENTS.md shapes behaviour, skills package repeatable processes (https://developers.openai.com/codex/concepts/customization).
- Research-backed: instruction-following drops as instruction count grows (https://arxiv.org/abs/2507.11538) and over multi-turn chats (https://arxiv.org/abs/2505.06120).
- Research-backed: brainstorming groups pick ideas no better than chance (https://research.rug.nl/en/publications/productivity-is-not-enough-a-comparison-of-interactive-and-nomina/); LLM idea pools lose variety as they grow (https://arxiv.org/abs/2409.04109).
- Research-backed: seeing others' estimates narrows spread without reducing error (Lorenz et al. 2011, PNAS, https://sg-dev.github.io/legacy-website/media/publication_files/PNAS-2011-Lorenz-9020-5.pdf); nominal group technique and Delphi gather independent judgements before aggregation (https://apps.dtic.mil/sti/pdfs/AD0690498.pdf).
- Research-backed: LLM judges show position, verbosity and self-preference bias (https://arxiv.org/abs/2306.05685, https://arxiv.org/abs/2404.13076) and sycophancy (https://arxiv.org/abs/2310.13548).
- Research-backed: LLM errors are substantially correlated across providers (https://proceedings.mlr.press/v267/kim25e.html).
- Research-backed: sampling several answers and voting improves reliability (https://arxiv.org/abs/2203.11171).
- Formal standard, intelligence domain: ICD 203 requires distinguishing underlying information from analysts' assumptions and judgements (https://www.dni.gov/files/documents/ICD/ICD-203.pdf). No standard covers tagging which agent proposed an option.
- Vendor recommendation: multi-agent systems use about 15× the tokens of chat and suit tasks valuable enough to pay for it (https://www.anthropic.com/engineering/multi-agent-research-system).

## Research: framing, goal-level briefs and delegation

Questions: whether agents and subagents should be briefed with goals or steps; what practice exists for questioning a task's framing; whether agents delegate or ask unprompted. Checked 17 November 2026 by a web-research subagent, then challenged by a Codex review.

- Vendor recommendation: prompts at the "right altitude", "specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics", avoiding both brittle hard-coded logic and vague prompts that assume shared context (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Explain the reason behind instructions, and prefer general instructions over hand-written step-by-step reasoning (https://platform.claude.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices).
- Vendor recommendation: subagent briefs need an objective, output format, tool guidance and boundaries; terse briefs led to duplicated work (https://www.anthropic.com/engineering/multi-agent-research-system).
- Vendor recommendation: OpenAI's reasoning models need no "think step by step" prompting, which "may not enhance performance (and can sometimes hinder it)" (https://developers.openai.com/api/docs/guides/reasoning-best-practices).
- Common practice: understand the problem before converging on a solution, using the 5 whys when sponsors state solutions (https://www.informit.com/articles/article.aspx?p=3172444); the XY problem (https://en.wikipedia.org/wiki/XY_problem); reframing before solving (Wedell-Wedellsborg, HBR 2017).
- Research-backed: agents default to silent assumptions over asking on underspecified tasks; access to a simulated user improved results by up to 74% (https://arxiv.org/abs/2502.13069). A 2025 paper reports, as prior work from Vu et al. 2023 rather than its own measurement, that prompting models to hunt for false premises hurts answers when premises are valid (https://arxiv.org/abs/2504.06438).
- Vendor recommendation: recent Claude models delegate to subagents proactively; the guide warns Opus 4.6 may spawn them where a direct approach would do, and says Opus 5 delegates more readily still (https://platform.claude.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices).
- No standard or study found on agents reframing the problem itself, or comparing goal-level and step-level subagent briefs head to head.

## The writing guide

### Origin

`agents/skills/writing-for-agents/SKILL.md` arrived on 19 August 2026 in commit `fa08915166` ("tweak prompts") with no provenance or attribution. Comparing it with the upstream (fetched 17 November 2026 via the GitHub API) shows a fork of Matt Pocock's MIT-licensed `writing-for-agents`, renamed from `writing-great-skills` on 23 July 2026: 7 of 11 headings match, near-verbatim passages, and four local sections added ("The pass", "Where the rule goes", "What earns space", "After a correction").

### Research

Checked 17 November 2026 by a web-research subagent; status labels per root AGENTS.md.

- Vendor recommendation: concise skills that assume a capable model, exact scripts only for fragile tasks and heuristics otherwise, evaluations before writing much; and "you don't need" a skill about writing skills (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
- Vendor recommendation: Codex discovers skills by name and description and loads the body when chosen (https://developers.openai.com/codex/concepts/customization), contradicting the old guide's claim that only Claude discovers skills. It scans `.agents/skills` in every directory from the working directory up to the repository root, and a skill's `agents/openai.yaml` with `policy: allow_implicit_invocation: false` stops implicit invocation while explicit `$skill` invocation still works (https://learn.chatgpt.com/docs/build-skills, where `developers.openai.com/codex/skills` redirects, checked 17 November 2026).
- Research-backed (preprint): repository context files did not generally raise task success and added over 20% inference cost; they helped for non-standard, project-specific practice (https://arxiv.org/abs/2602.11988). Guidance refined against probe tasks resolved 33.0% on SWE-bench Verified against 28.3% for its starting file (https://arxiv.org/abs/2606.20512).
- Common practice: the upstream guide cites no research and states "There is no automated eval".

### Comparison

Method: 17 November 2026, Claude Code 2.1.326. Nine Claude subagents (tools `Read,Grep,Glob,Write`) each wrote one new skill for this repository, for three tasks (cutting a mobile release, adding an environment variable, investigating a production error) under three conditions: the old guide, the short brief, and no guide. A Codex CLI 0.167.0 judge, read-only, ranked each task's three skills blind with shuffled labels, checking their claims against the repository.

| Task | Old guide | Short brief | No guide |
|---|---|---|---|
| Mobile release | 2nd, 917 words | 1st, 869 | 3rd, 1,359 |
| Environment variable | 2nd, 934 | 1st, 846 | 3rd, 1,681 |
| Production error | 3rd, 733 | 2nd, 849 | 1st, 1,454 |

The judge found factual errors under every condition; its stated pattern was that better skills explained relationships easy to miss across files, and worse ones repeated discoverable details or added gates with no concrete need. One judge over three tasks is a small sample.
