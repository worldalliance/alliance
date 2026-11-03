# Decisions

## Smaller choices

- `oauth.controller.ts` was past the 500-line limit, so it was split first, in its own commit, along the lines a read-only codex subagent recommended: callback handling into `OAuthCallbackService`, shared session helpers into `OAuthSessionService`, the proof cookie into `oauth-browser-proof.ts`, with routes, decorators and class/method names unchanged.
