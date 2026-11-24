# Decisions

- The review-combining (`gpt-5.2`) and link-formatting (`gpt-4o-mini`) steps keep their pinned models: they call the OpenAI chat completions API directly, which requires a model name. Agent decision; the user was told and did not ask to change them.
- The Claude reviewer uses `--model opus` rather than no flag: the `default` model can be changed by an organization default or a future Claude Code release, while `opus` always names the latest Opus (EVIDENCE.md, Research). The workflow installs the latest Claude Code each run, so the alias stays current.
