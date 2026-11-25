# Evidence

## Research

Checked 2026-11-24 by a research subagent.

- Claude Code authentication (https://code.claude.com/docs/en/authentication), vendor recommendation: `claude setup-token` makes a one-year token for `CLAUDE_CODE_OAUTH_TOKEN`, "for CI pipelines and scripts where browser login isn't available".
- OpenAI's "Maintain Codex account auth in CI/CD" (https://learn.chatgpt.com/docs/auth/ci-cd-auth), vendor recommendation: "The right way to authenticate automation is with an API key"; its ChatGPT-account flow says "Do not use this workflow for public or open-source repositories."
- GitHub's `GITHUB_TOKEN` docs (https://docs.github.com/en/actions/concepts/security/github_token), vendor documentation: events it triggers create no new workflow run; GitHub recommends an App or personal token for that.
- Claude Code's release channels (https://code.claude.com/docs/en/setup#configure-release-channel), vendor documentation: stable is "typically about one week old, skipping releases with major regressions". The docs don't mention npm dist-tags; that npm's `stable` tag follows that channel is an inference. `npm view @anthropic-ai/claude-code dist-tags` on 2026-11-24: `stable` 2.1.325, `latest` 2.1.331.
- Codex sandboxing (https://learn.chatgpt.com/docs/sandboxing), vendor documentation: on Ubuntu 24.04 Codex's Linux sandbox needs an AppArmor workaround; macOS runners avoid it.

## Experiments

- 2026-11-24, Claude Code 2.1.322 on macOS: with `CLAUDE_CONFIG_DIR` pointing at a folder whose `settings.json` is `{"env":{"CLAUDE_CODE_OAUTH_TOKEN":"<token>"}}` and no such variable in the environment, `claude auth status --json` reports `loggedIn: true`, `authMethod: "oauth_token"`, as it does with the variable exported.
- 2026-11-24, gh against this repository: `gh pr list --state open --limit 1000 --json number,headRefName,isCrossRepository,commits` fails with "requesting up to 1,000,000 possible nodes which exceeds the maximum limit of 500,000".
- 2026-11-24, npm 11 on macOS: `npm view @openai/codex@latest version --before=<a week ago>` and `npm view '@openai/codex@*' version --before=…` both print 0.172.0, published that day, so `--before` doesn't apply to `npm view`.
- 2026-11-24, runs 45494839485 and 45495927670 of this workflow on `macos-latest`, from this branch with PR opening turned off: Claude Code 2.1.325, signed in through the settings file above with `ci/review/CLAUDE_CODE_OAUTH_TOKEN`, recorded its captures, and the app's typecheck, 418 bun tests and 145 Playwright tests passed on them. Codex 0.169.0 accepted the `codex login --with-api-key` sign-in, but each edit turn ended with "Quota exceeded. Check your plan and billing details." from `ci/review/OPENAI_API_KEY`, so no Codex captures were recorded.
