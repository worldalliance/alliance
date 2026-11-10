# Decisions

## D1. Endpoint

Agent decision. `GET /kora/participants/count` on `KoraController` returns `{ count }`, the number of `kora_participant` rows. It is public, like `POST /user/nmembers` which the bar used before: `@UseGuards(AuthOptionalGuard)` with `@Public()`, the repo's pattern for an unauthenticated route that still names a guard.

## D2. Loading and failure copy

Agent decision. The page keeps its existing "Loading participant count…" and "Participant count unavailable" text, now driven by the Kora count query.
