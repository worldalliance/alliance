# Evidence

- **Vendor guidance:** [OpenAI: Build skills](https://developers.openai.com/plugins/build/skills) supports a concise skill with references and optional scripts for deterministic work. It does not validate this idea-generation method or its ranking quality.
- **Research inspiration:** [The Alien Space of Science](https://arxiv.org/abs/2603.01092), version 3, separates conceptual combination search from LLM decoding. This workflow borrows atom recombination and separate judgment; it does not reproduce the paper's learned coherence or cognitive-availability models.
- **Code inspection:** `server/src/analytics/action-stats-analytics.service.ts` computes stored completion rates from completed and joined counts; `server/src/analytics/actionstats.entity.ts` records their calculation timestamp. Historical snapshots can have different denominator semantics and cohorts.
- **Agent judgment from two exploratory runs:** The initial 24-atom bank tends toward testing, information correction and workflow improvements. Mixing topic facets and periodically proposing new mechanisms may broaden the search; superiority over ordinary brainstorming has not been established.

## Validation

- **Executed:** `bun run test agents`: 54 passing tests, including 12 focused sampling/ranking/CLI tests. Formatting and `git diff --check` passed.
- **Executed:** The read-only history query parsed 109 action records from the isolated worktree database; raw action content was not saved.
- **Executed:** An independent agent used the skill to generate two candidates with separate generator agents and a fresh reviewer, then produced a complete ranked report. Its findings led to a defined mission-area field, recorded requested focuses with uncovered-focus warnings, explicit log locations and treatment of unavailable historical references.
- **Validation limitation:** The bundled Python skill validator requires unavailable PyYAML and does not recognize the repository's Claude invocation flag. Bun's YAML parser verified frontmatter and both explicit-only invocation settings.
- **Validation scope:** `dupcheck` and `covercheck` ran successfully but their configured source paths exclude `agents/skills`; the new code was read directly and exercised by focused tests and the independent workflow trial.
