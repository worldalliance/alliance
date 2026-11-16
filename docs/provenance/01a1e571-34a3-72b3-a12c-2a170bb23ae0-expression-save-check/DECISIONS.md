# Decisions

All entries are agent decisions unless they say otherwise. Spec references are to `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`; "the first PR" is `docs/provenance/01a1d107-5251-70f7-a755-312c076b4a53-expression-core`.

## Delivery

- **Built on the merged PRs.** This branch was written beside the first two PRs and rebased onto them as merged, so it follows what their reviews changed, as the entries below say where that touched this PR's code.
- **Scope checks in `convert-scope.ts`.** The source maps would take `convert.ts` past the repository's 500-line limit, so `checkScope`, `readsAsName` and `STRICT_RESERVED` move to `convert-scope.ts` ahead of them, the split a read-only codex review recommended: they check the scope a caller passes and share no state with the recursive converter, which stays whole.
