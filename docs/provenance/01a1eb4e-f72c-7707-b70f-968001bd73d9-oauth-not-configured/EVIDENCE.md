# Evidence

Research agent, 2026-11-17, on how established apps treat a sign-in provider that isn't configured. Only the findings this task's decisions touch are kept.

- Generic error-message guidance says to name the problem and avoid "an error occurred". NN/g, https://www.nngroup.com/articles/error-message-guidelines/ (common practice; cites no study). Google's technical-writing course, https://developers.google.com/tech-writing/error-messages (vendor recommendation).
- Open-source auth stacks mostly hide unconfigured providers and refuse direct requests to them: Auth.js lists only configured providers at `GET /api/auth/providers` (https://next-auth.js.org/getting-started/rest-api); Supabase Auth publishes enabled providers at `GET /settings` and answers `provider_disabled` otherwise (https://supabase.com/docs/guides/auth/debugging/error-codes). Common practice. Hiding was left out of scope by the user.
- RFC 6749 §4.1.2.1 sends authorization errors back to the caller's redirect URI as query parameters, and only to a validated URI (https://www.rfc-editor.org/rfc/rfc6749#section-4.1.2.1, formal standard; applies to authorization servers, followed here by analogy). RFC 9700 forbids forwarding to unvalidated URIs (https://www.rfc-editor.org/rfc/rfc9700, formal standard).
