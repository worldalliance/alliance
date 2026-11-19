# Evidence

Checked 17–18 November 2026. Claude Code 2.1.327, Codex CLI 0.167.0. Status labels follow the root `AGENTS.md` **Established practice** categories.

## Audit

Method: every top-level transcript in the `alliance-agent-chats` bucket, 6,021 Claude and 763 Codex sessions uploaded 2–17 November 2026, of sessions dated 24 September–17 November, indexed by the sessions that read, cat'd, grep'd or invoked each skill. Six Claude subagents audited the skills in groups (review; implement, trim-comments, subagents; provenance; UI; tools; small and user-only), reading condensed transcripts and grepping the corpus, and checked each finding against the skill's text on the session's date. A Codex subagent then verified their repository claims (it ran `common`'s typecheck, read the configs and scripts, reproduced the `--verbose` requirement) and spot-checked their transcript citations. Load counts overstate use: most loads are review-loop reviewers and fixers reading a skill a commit touched. Nearly all interactive sessions are one person's.

Findings this change acts on, each from the audit unless noted:

- `playwright` told agents not to start the apps, false in a worktree (one agent skipped a browser check for it, at least 69 sessions started a server anyway); 16 sessions hit a missing browser build, and 7 found `channel: "chrome"` on their own.
- The `playwright` token recipe omitted `sessionGeneration`, which the session guard compares (`server/src/auth/tokens.ts`, `session.service.ts`); `demo-action/mint-token.ts` read `JWT_SECRET` only from `server/.env`, which team checkouts don't hold (verified by the Codex check).
- Linear's 10,000-point query-complexity limit: 65 sessions got `Query too complex`, 49 of the 55 that opened by reviewing a Linear project.
- `common`'s typecheck covers `scripts/` and `agents/`; five sessions concluded nothing did and skipped it. `dupcheck` leaves out `agents/` and tests; agents found that out per run.
- The server sends PostHog events from production only, Mailgun webhook events aside; one investigation of a staging error found nothing for that reason. `scripts/with-secrets.sh` doesn't load `.env.devtools`.
- `debug`: never typed by a person, loaded by Codex in 23 review runs, where its experiment rules helped and its output contract was never followed. `spec`: `disable-model-invocation` refused the agent twice when the user asked for it in words.
- `ux-forms-platform`: 244 of 274 sessions that loaded `ux-guidelines` loaded it too; agents who read one half missed rules from the other.
- `claude -p --output-format=stream-json` without `--verbose` exits 1 on 2.1.327 unless settings enable verbose (reproduced by the Codex check).
- UX: 45 sessions scripted colour emulation as a routine step and none reported a finding from it; one agent read the 14 px dense-text default as a floor and rewrote smaller text across a branch; `disabled` on a focused, pending button dropped focus to `body` in four reviewed branches, each fixed with `aria-disabled`; low-value findings under the visual-system items, such as a bare `20px` heading or a `min-height: 32px` with no stated reason, each cost a fixer pass in four sessions, from reading "an arbitrary value states its reason" and the defaults as obligations; a user stated the admin principle in claude/31d963bf, which the variable-framework spec records.
- The handed-over-material rule: about 90 sessions started from a Linear issue; three asked about its points.

## Review loop sessions

Method: the audit's `review` group sorted the 5,903 sessions in its corpus that loaded `review-base`, `review` or `review-loop` by their first prompt into reviewer runs, fixer runs, 142 interactive sessions and other headless runs, then parsed each by script: the user's turns in interactive sessions, and the Bash commands each reviewer ran with their durations. Counts are regex-parsed, so approximate. Scripts and output were kept in `.scratch/skill-audit/review-work/`, not committed.

- 37 of the 142 interactive sessions open by asking to read a `.scratch/HANDOFF*.md` and continue, and in 30 sessions the user paused a loop to have one written.
- 12 user turns in hub sessions ask for progress ("what's the progress?" and the like).
- Of the 1,842 reviewer runs from 13 November (when reviewer worktrees began to be reused) to 17 November, 705 ran `scripts/new-worktree.sh`; creating and removing those worktrees took a median 46 s per review, p90 127 s.

## Read-only flags

`claude --permission-mode plan -p --output-format=stream-json --verbose`, asked to write a file in `.scratch/`, wrote nothing in the checkout and replied that plan mode blocks every write but its plan file, which it put under `~/.claude/plans/`. Claude Code 2.1.327, 17 November 2026.

Plan mode still runs the Bash commands the project's settings allow: a branch review on 18 November drove the CLI with `--permission-mode plan` and this repository's allow rules through a mock endpoint, and its `bun run build` ran and wrote a file, while the same call without the allow rules was refused. With `--disallowedTools Bash` added, the session's tool list held no Bash (Claude Code 2.1.327, 18 November 2026).

## Codex beside Claude

Question: whether Codex reviewers found defects Claude reviewers didn't. Method: a Claude subagent matched every Codex reviewer run to its branch and round, deduplicated must-fix findings, and judged semantically whether any Claude reviewer on the branch raised the same defect at any tier, before or after, reading the fixer ledgers for outcomes. Descriptive, not controlled.

- 307 Codex runs; 304 on four branches the user chose, each beside a Claude reviewer on the same commit in the same round; on `all-2032-chat-ui` Codex joined at round 49, on the others from rounds 1–6.
- 53 code defects no Claude reviewer on the branch raised; the Claude fixer classified 43 fix-now. Codex reproduced 43 of the 53 with a probe.
- 7 Claude must-fix defects Codex missed, an undercount, since Claude files most real defects at should-fix.
- On shared commits Codex filed 221 must-fix findings against Claude's 13. 160 of the 307 had no must-fix; Codex re-filed already-ruled findings across rounds; its median run took about twice Claude's.

## Splitting

Question: whether splitting a commit reveals more findings, the purpose the user recalled. Method: a Claude subagent parsed 4,405 reviewers' findings JSON and the fixer ledgers, identified 111 executed splits by file overlap between rounds, and compared code findings on a split commit's parts in the following rounds with findings on unsplit commits. Observational.

- Executed splits: 1.68 code findings at the round of the split finding, 3.45 summed over the parts the next round (ratio 2.05; 78 rose, 18 fell). Unsplit commits: 1.20 to 1.00 (0.83). Dropped splits: 0.85.
- A split made 2.82 commits on average, and per-review yield fell to the ordinary per-round decay, so the gain tracks the extra reviews; no loop tried more reviewers on an unsplit commit.
- 203 of the parts' located findings pointed at lines whose text was in the original commit.
- One of 430 dropped split findings cited squash merging; 190 drops were the same split re-filed.

## friend repair

`select database, name from typeorm_metadata where "table" = 'friend'` in the `agents` worktree's database `alliance_agents` returned `alliance` for both rows. `migration:generate --check --dryrun` printed 18 lines about `friend`; after `UPDATE typeorm_metadata SET database = current_database()` it reported "No changes in database schema were found". Cause per ALL-1544.

## Token counts

Method: `claude -p --output-format=json --tools ""` on a prompt of "Reply with OK." alone and followed by each file, subtracting the first run's input tokens from the second's. Claude Code 2.1.327, default model, which on that version and date was `claude-opus-5-5`. The merged file was measured at 100 lines, before the UX misapplied-rules corrections and the admin principle changed about a dozen of them, so its line ranges and total differ slightly from the file as shipped.

- Merged `ux-guidelines/SKILL.md` with source links moved out: 6,210 tokens.
- `ux-guidelines/SKILL.md` as committed before this change: 5,415 tokens.
- Prefixes of the merged file: lines 1–79, 4,956 tokens; lines 1–85, 5,217. Measured 17 Nov 2026.
- A wording-only tightening keeping every rule, exception, status letter and source name: 6,018 tokens. With nearly every inline source tag stripped by regex as well (an approximation): about 5,011. Lines 1–20, the legend and scope preamble: 872.

## Compaction in UX sessions

Method: in the audit's corpus as downloaded (`.scratch/skill-audit/raw/`, not committed), every session `index.json` lists as loading `ux-guidelines` or `ux-forms-platform`, 458 files, was searched for `compact_boundary` (Claude) or `"type":"compacted"` (Codex). None matched. Across all 6,784 transcripts, about 13 contain a compaction marker. Checked 17 Nov 2026.

Claude Code's skills documentation (https://code.claude.com/docs/en/skills, vendor documentation, checked 17 Nov 2026) states that after compaction it re-attaches the most recent invocation of each skill, keeping the first 5,000 tokens of each, within a 25,000-token budget shared across skills and filled from the most recently invoked, and recommends invoking a skill again after compaction to restore its full content.

## Research

Checked 17 November 2026 by two Claude research subagents.

- Mixing model vendors in review: no study found compares adding a second vendor's reviewer with repeated runs of the same model; neither paper below has repeated same-model runs as a control. Research-backed, weak (preprints): combining two models' findings on 150 diffs lowered F1 (https://arxiv.org/html/2606.15689v1); comparing same-model and cross-model review passes on generated code, cross-model review helped in one direction only (https://arxiv.org/html/2607.21656v1).
- Per-commit build rules: common practice (https://www.kernel.org/doc/html/latest/process/submitting-patches.html, https://git-scm.com/docs/SubmittingPatches) requires each patch to build for bisecting a history that keeps the commits; GitHub squash merging keeps only the PR's result (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github).
- Skills: vendor recommendation, keep `SKILL.md` lean and put reference material in files beside it, which cost nothing until read (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md); keep each skill to one job and test descriptions against prompts (https://learn.chatgpt.com/docs/build-skills). Claude Code reserves `disable-model-invocation` for skills with side effects or whose timing the user controls, and blocks such a skill when the user asks for it in words (https://code.claude.com/docs/en/skills, read as a summary).
- Handed-over requirements: formal standards keep an approved, traced requirement approved and send new or changed items for approval. ISO/IEC/IEEE 29148:2018 was read only through its preview (https://cdn.standards.iteh.ai/samples/72089/62bb2ea1ef8b4f33a80d984f826267c1/ISO-IEC-IEEE-29148-2018.pdf), which shows its definitions of requirements management and traceability (3.1.22–3.1.23); the management activity and approval status model come from secondary material (https://www.jamasoftware.com/requirements-management-guide/requirements-gathering-and-management-processes/defining-and-implementing-requirements-baselines/); IIBA BABOK v3's separate Trace, Assess Changes and Approve tasks were read through study guides (https://open-exam-prep.com/study-guides/cbap/requirements-life-cycle-management/approve-requirements). Research-backed (preprints, abstracts and summaries only, simulated users on underspecified SWE-bench tasks): an agent asking only when uncertain resolved 69.4% of tasks against a 61.2% baseline (https://www.alphaxiv.org/abs/2603.26233); one asking targeted questions matched GPT-5 with 41% fewer questions, and results plateaued or fell as questions grew (https://arxiv.org/html/2604.14624). Vendor: GitHub Copilot's coding agent treats a well-scoped, human-written issue as the spec (https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results).
