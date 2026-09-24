# Validation

- Local GitHub-script tests exercise exact-head validation, fork PR support, authorization on reruns, filename traversal, symlinks, malformed reports, file size bounds, PNG signatures, and Markdown escaping.
- `actionlint`, `shellcheck .github/actions/*/*.sh .github/scripts/*.sh`, scoped `bun run format:check`, and `git diff --check` pass.
- The sample fixture change passes `bun run typecheck` from `apps/mobile`.
- Implementation PR: https://github.com/worldalliance/alliance/pull/200
- Sample PR: https://github.com/worldalliance/alliance/pull/201
- Initial iOS run: https://github.com/worldalliance/alliance/actions/runs/35945130442
- The remote request validation, macOS checkout, Bun/Java installation, Maestro/Postgres setup, simulator discovery, model proxy initialization, and sudo removal succeeded. The model request then failed with `Quota exceeded. Check your plan and billing details.`
- This run produced no screenshots and posted no evidence comment. Native exploration, Android execution, and attachment publishing remain unverified until model API access is restored and the complete workflow succeeds.
