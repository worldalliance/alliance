# Evidence

## Research

Question: does Claude Code's `opus` alias, or omitting `--model`, give the latest Opus? Source: Claude Code model configuration docs, https://code.claude.com/docs/en/model-config (vendor documentation, checked 2026-11-24).

- The `opus` alias "uses the latest Opus model" and resolves to the newest version on the Anthropic API (Opus 5.5 on the check date); aliases update over time.
- Omitting `--model` uses the `default` setting, which on Pro, Max, Ultra, Team, Enterprise and the Anthropic API was Opus 5.5 on the check date. It has changed by plan and version before (Sonnet 5 on Pro and Team Standard before v2.1.280), and an organization default model set by an admin replaces it.

## Measurements

- `openai/codex-action@v1`, read through the GitHub API on 2026-11-24 at the `v1` tag's commit `306c6a196a99dcc6582530c396a19d2672d5e9ec`: [`action.yml`](https://github.com/openai/codex-action/blob/306c6a196a99dcc6582530c396a19d2672d5e9ec/action.yml#L43-L65) defaults both `model` and `codex-version` to `""`, [`src/main.ts`](https://github.com/openai/codex-action/blob/306c6a196a99dcc6582530c396a19d2672d5e9ec/src/main.ts#L264) turns the empty `model` into `null`, and [`src/runCodexExec.ts`](https://github.com/openai/codex-action/blob/306c6a196a99dcc6582530c396a19d2672d5e9ec/src/runCodexExec.ts#L293-L295) passes `--model` to `codex exec` only when it is non-null. With neither set, each run installs the latest `@openai/codex` and uses that release's default model.
