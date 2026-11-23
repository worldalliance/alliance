## Sources

Checked 2026-11-23 by a research subagent and the implementing agent.

- Anthropic's setup page (https://code.claude.com/docs/en/setup), vendor recommendation: the npm package installs the same native binary through per-platform optional dependencies; each release publishes `manifest.json` with a SHA256 per platform and a GPG-signed `manifest.json.sig`; distributors set `DISABLE_UPDATES` when shipping Claude Code through their own channels.
- Anthropic's Agent SDK (https://code.claude.com/docs/en/agent-sdk/typescript), vendor practice: it bundles the native binary as per-platform optional npm packages.
- OpenAI's Codex CLI docs (https://learn.chatgpt.com/docs/codex/cli), vendor documentation: cover `install.sh`, npm and Homebrew only, nothing on pinning or verifying a download. The `rust-v0.167.0` GitHub release publishes per-triple tarballs with `codex-package_SHA256SUMS`.
- electron-builder's contents page (https://www.electron.build/docs/contents), vendor recommendation: `extraResources` for native binaries and CLI tools needed at runtime, landing in `Contents/Resources` on macOS and read through `process.resourcesPath`.
- Apple's "Placing content in a bundle" (https://developer.apple.com/documentation/bundleresources/placing-content-in-a-bundle), vendor recommendation: helper tools in `Contents/MacOS`, dynamic libraries in `Contents/Frameworks`; resources are everything that isn't code. It conflicts with electron-builder's `extraResources` for signed builds; `@electron/osx-sign` signs every binary it finds anywhere in the bundle (https://github.com/electron/osx-sign/blob/main/src/util.ts, source code).
- GitHub's Dependabot ecosystem table (https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories), vendor documentation: `bun` (Bun 1.1.39 and later, text `bun.lock`) supports version updates, not security updates; the options reference (https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) has a per-entry `directory` and an `allow` list.

## Package contents

`npm pack`, 2026-11-23, of `@anthropic-ai/claude-code@2.1.322`, `@anthropic-ai/claude-code-darwin-arm64@2.1.322`, `@openai/codex@0.167.0` and `@openai/codex@0.167.0-darwin-arm64`:

- Claude's platform package holds one `claude` binary (323,702,464 bytes on darwin-arm64), `LICENSE.md` ("© Anthropic PBC. All rights reserved", pointing to Anthropic's legal page) and a README.
- Codex's platform package holds `vendor/aarch64-apple-darwin/bin/codex` (270,815,376 bytes), `bin/codex-code-mode-host`, `codex-path/rg`, `codex-package.json`, and `codex-resources/voice/` (GStreamer and GLib dylibs, a NOTICE and licences including LGPL-2.1). Neither Codex package has a licence file; `package.json` says Apache-2.0.
- After `bun install` in `agents/desktop` (Bun 1.3.14, then `bun install --frozen-lockfile` under Bun 1.4.4 with no changes), `bun.lock` holds a sha512 for each of the eight Claude and six Codex platform packages, and `node_modules` holds only the host's.

## Codex's npm launcher

`@openai/codex@0.167.0`'s `bin/codex.js` maps the platform to a target triple (Linux to `*-unknown-linux-musl`), finds `vendor/<triple>/bin/codex` in the platform package, sets `CODEX_MANAGED_PACKAGE_ROOT` and one `CODEX_MANAGED_BY_<package manager>` variable, and execs the binary with its arguments. It changes no other environment, PATH included.
