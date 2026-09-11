---
user: Charles Lien
task: Apply review fixes to the commit that adds provider connect and disconnect to web settings
---

- Fix every must-fix finding. The agent's review found one: on web settings, Connect navigates straight to `GET /auth/:provider/start?intent=link`. Once the 30-minute access cookie has lapsed, that navigation skips the client's token refresh and leaves the member on a raw `{"message":"Unauthorized","statusCode":401}` page.
- Fix every should-fix finding that the commit itself introduced. The agent's review found one: the new component test builds an `AuthContextType` by hand instead of using `apps/frontend/src/testing/authValue.ts`.
- Also fix findings of any tier that only dedupe code, change no code (comments, commit messages), delete dead code, rename without changing behavior, or correct inaccurate copy. The agent's review raised one nit of that kind: the same `getBaseUrl`/`getApiUrl` stubs copied into two test files.
