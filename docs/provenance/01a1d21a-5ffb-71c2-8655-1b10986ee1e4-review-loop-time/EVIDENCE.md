# Evidence

## Where review-loop time goes

Method, 2026-11-12: two read-only codex subagents, on codex CLI 0.167.0, analysed 13 branches' saved reviews (`.scratch/review-loop/<branch>/round-<n>/<sha>.json`), fixer ledgers, worktree lifecycle logs and the timestamped Claude Code transcripts of their hubs, reviewers and fixers: 178 rounds, 1,009 saved reviews, 189 fixer sessions. The hub, reviewer and fixer sessions on `all-2032-chat-ui`, `envvars` and `member-sms-chat` ran Claude Code 2.1.316 through 2.1.323, read from the transcripts' `version` field; the other ten branches' versions weren't read. Phase times are elapsed intervals from tool launch to result, overlaps counted once, not CPU time. Three branches (`all-2032-chat-ui`, `envvars`, `member-sms-chat`) hold 87% of the time, so the sample is skewed.

- Recorded round time was 157 hours: fixer phases 75 (48%), gaps between phases 47 (30%), reviewers 35 (22%).
- Fixer sessions, timed by their own transcripts, ran 73 of those 75 hours: running checks 42.3 (58%), model work between tool calls 14.7 (20%), background waits 6.4, API failures and retries 5.6, and 2.6 hours in which eight fixers had finished their report but stayed alive until a fallback reminder or monitor fired.
- Gaps (47.5 hours): waiting for the owner's answers 21.1 (44%), the machine asleep overnight 11.5, usage-limit interruptions 7.9, recovery after failed runs 3.0, worktree removal 2.4, hub orchestration 1.7. The largest single wait, 11.7 hours on `all-2032-chat-ui` round 13, followed the hub asking whether to keep running the no-cap loop; the owner answered "continue".
- Worktrees: 737 measured creations took 3.3 hours (median about 12 seconds, p90 about 29) and 603 removals 4.0 hours (median about 17 seconds, p90 about 40), 7.15 hours after overlaps. `bun install` accounted for 1.44 of the creation hours; the rest is copying the development database, creating the test database, checkout and configuration. Removal drops both databases and deletes the checkout.
- Reviewers (89 worker-hours, run in parallel): model work 42.9 (48%), checks 36.3 (41%; end-to-end 9.9, typecheck 9.8, unit tests 7.4, mixed 8.7), reading 6.0. Waiting on the slowest reviewer of each batch added 7.0 hours.
- Load averages around 800 to 880 appear in `uptime` output inside `all-2032-chat-ui` fixer transcripts (rounds 21, 33, 39), alongside timing-test failures, on a 10-core machine.

## What later rounds find

Same method and date.

- 58% of findings after round 1 cite text that was present and unchanged when an earlier round reviewed it, including must-fix findings such as a Stop button that could send a draft (`all-2032-chat-ui` round 29) and valid records rejected by host functions (`all-2172-expression-core` round 8).
- Replaying stopping rules on the histories, every rule skipped later must-fix findings: stopping a commit once its fixes were all should-fix or nit, 51; stopping after nit-only fixes, 21; continuing only after a must-fix or more than 20 or 50 changed lines, 31 or 38; a three-round cap, 53.
- Fix-now findings by what they concern: `DECISIONS.md` entries 50.7%, `REQUIREMENTS.md` 19.7%, none 25.1%, unrecorded 4.5%. The decision-linked share rises from 37% in round 1 to 59% from round 13 on. A decision label doesn't make work optional: required shutdown and persistence behaviour on `all-2032-chat-ui` is implemented through agent decisions.
- Deferred and optional work: an optional "migrate if easy" commit on `provenance-unknown-origin` drew 14 fix-now findings over nine rounds before it was cut. On this task's first attempt, where the owner deferred how all four designs were done, 59 of 71 findings in six rounds concerned those four designs, and their rules grew from a sentence each to paragraphs of edge cases, each round finding issues in what the previous round added.

## How others bound review loops

Question: how do human code review, inspection practice, AI review products and LLM refinement research end a review or keep it from drifting? Researched 2026-11-12 by a Claude subagent with web access, whose own subagents report opening each URL.

- Human review ends with a verdict rather than another full pass. Google approves a change that "definitely improves the overall code health … even if the CL isn't perfect", and allows LGTM with comments for minor remaining issues (https://google.github.io/eng-practices/review/reviewer/standard.html, https://google.github.io/eng-practices/review/reviewer/speed.html). Vendor documentation.
- Iterative LLM refinement front-loads its gains: CRITIC reports "2-3 rounds of corrections yield most of the benefits" (https://arxiv.org/abs/2305.11738), and self-correction without an outside signal can make results worse (Huang et al., https://arxiv.org/abs/2310.01798). Empirical studies.
- Repeated editing drifts: code under repeated LLM refinement tends to grow with little change in meaning (https://arxiv.org/abs/2509.06770, abstract only), and AlpacaEval's LLM judge favours longer outputs (https://arxiv.org/abs/2404.04475). Empirical studies.
- Anthropic's prompting guidance says Claude Opus 4.5 and 4.6 tend to overengineer, and suggests "Only make changes that are directly requested or clearly necessary" (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). Vendor documentation.
