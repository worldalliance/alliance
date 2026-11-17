# Decisions

- **Copy** (agent decision): "<Provider> sign-in isn't set up on this server.", the issue's wording, shared by member sign-in, linking and Kora. It says the failure is permanent; a per-screen next step was left out to keep the change minimal.
- **Error value** (agent decision): a new `OAuthError.NotConfigured` (`not_configured`), so the existing web notice (`sharedweb/lib/oauth.ts`), Kora's message map and mobile's error handling show it with no new UI. Installed mobile builds that predate it parse an unknown error as `Failed`, as they treat the 503 today, and staging and production always have the providers configured.
- **Where the check runs** (agent decision): an `isConfigured()` on each `OAuthClient`, read from the same settings `config()` validates. `start` checks it after `resolveReturnTo`'s allowlist and the link intent's authentication, so the error redirect is only ever to an allowed origin and an unauthenticated link still answers 401.
- **Browser-session endpoints** keep throwing the 503 (requirement 2). Reporting a typed error there needs a response-shape change that older builds can't read.
