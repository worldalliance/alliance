# Decisions

- The review-combining (`gpt-5.2`) and link-formatting (`gpt-4o-mini`) steps keep their pinned models: they call the OpenAI chat completions API directly, which requires a model name. Agent decision; the user was told and did not ask to change them.
- The Claude reviewer uses `--model opus` rather than no flag: the `default` model can be changed by an organization default or a future Claude Code release, while `opus` always names the latest Opus (EVIDENCE.md, Research). The workflow installs the latest Claude Code each run, so the alias stays current.
- The workflow installs Claude Code with `npm i -g --engine-strict @anthropic-ai/claude-code@latest`. Without both flags, npm silently installs the newest release whose `engines.node` admits the runner's Node, which on Node 20 was a release from before `opus` meant Opus 5.5 (EVIDENCE.md, Measurements); this way a future Node floor bump fails the step instead of reviewing on an older Opus.
