# Decisions

## Lock the member's row, not the account rows

`unlink()` counted the member's other providers and deleted in separate statements, so two overlapping disconnects each saw the other provider and both went through. A member with no password could end up with no way in besides the forgot-password email. The check and the delete now run in one transaction that first takes `pessimistic_write` on the member's `user` row. A second disconnect waits on that lock and counts after the first has deleted.

Rejected: locking the `oauth_account` rows the count reads. Each request would hold the row the other wants to delete, so the overlap becomes a deadlock that Postgres breaks by failing one request with a 500.

Rejected: a single conditional `DELETE ... WHERE (password IS NOT NULL OR EXISTS other account)`. Under read committed, two of those can still each see the other's row before either commits.

Rejected: only disabling the other Disconnect buttons in the client. Two tabs, or web and mobile at once, still overlap.

## The e2e test repeats the pair five times

One pair of requests doesn't always overlap. Before the fix, 8 of 10 pairs removed both providers, so five tries all missing the race is unlikely.
