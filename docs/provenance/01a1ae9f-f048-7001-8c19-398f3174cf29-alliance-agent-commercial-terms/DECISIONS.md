---
user: Charles Lien
task: Record that the Alliance has agreed to Anthropic's Commercial Terms and that they cover redistributing the `claude` binary in the Alliance agent's public releases.
---

This task builds on the Alliance agent spec in `docs/provenance/01a1a949-c8f1-7000-9631-5610045dff02-alliance-agent-desktop-app/`. Its decisions stand except where an entry here replaces one.

- The spec's Credentials section treats both Commercial Terms questions as unconfirmed and has PR 4 (ALL-2029) start by getting the answers, stopping if redistribution isn't covered. `REQUIREMENTS.md` answers both, so releases ship the bundled CLIs with no download-on-first-launch fallback, and PR 4 is no longer gated on the answers (agent decision).
