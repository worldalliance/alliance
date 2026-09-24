---
name: pr-screenshots
description: Capture before/after PR screenshots remotely with GitHub Actions
disable-model-invocation: true
---

# PR screenshots

Resolve the PR number and current head SHA with `gh pr view`. Dispatch `pr-screenshots.yaml` from the repository's trusted default branch with inputs `pr`, `head_sha`, and `platform` (`ios` or `android`). Choose the platform relevant to the change; both runners provide browser tooling. Supply `focus` when the user identifies a particular journey.

The dispatcher must have repository write access. A fork PR is supported, but dispatch only after reviewing the exact head being authorized. The workflow runs PR code on a disposable host without application secrets or GitHub write access; the model proxy remains usable during the bounded run. A new head requires a new dispatch.

Follow the resulting run with `gh run watch`. Success requires the publishing job to post one comment describing the before/after pairs and linking the screenshot artifact, retained for 14 days. If capture fails, inspect the failed step and report the blocker instead of treating uploaded artifacts as a successful capture. Link the run and comment when finished.

The remote agent follows [REMOTE.md](REMOTE.md), chooses its own interactions, and uses synthetic data. The workflow requires the repository's `CLAUDE_CODE_OAUTH_TOKEN` secret. To test an unmerged version, dispatch with `--ref` pointing to a reviewed implementation branch. If GitHub has not registered the workflow yet, an explicitly authorized temporary push trigger on a test branch can register it; remove that trigger after the initial run.
