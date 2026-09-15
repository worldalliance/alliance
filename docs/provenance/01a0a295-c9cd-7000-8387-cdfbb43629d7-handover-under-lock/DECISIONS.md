# Decisions

## The handover takes the same row lock as unlink()

When `authenticate()` hands an unconfirmed account to whoever proved the address, it links the provider and then clears the password. Those were two separate statements. A disconnect of the new provider could land between them, sent from a session the old owner still holds, and see the password still set. It deleted the provider, then the password went too, and the account had no way in. The upsert and the user update now share a transaction that first takes `pessimistic_write` on the `user` row, the lock `unlink()` takes. A disconnect waits for both writes to commit, then sees no password and one provider, and gets `LastSignInMethod`.

`linkable()` still runs before the transaction. The race was about the account's ways in, and the claim checks it makes don't touch those.

The lock is taken for a confirmed address too, where the password stays. One path is simpler, and the lock is held for two short statements.

Rejected: have `link()` take an optional `EntityManager`. `link()` reads the user back after writing, which inside the transaction would come from another connection and miss the new provider. `saveAccount()` holds just the upsert, so the conflict key stays in one place for both callers.

## The e2e test pauses the handover with a subscriber

A `beforeUpdate` subscriber on `User` sends the disconnect when the password is about to be cleared. That point sits in the gap before the fix and inside the lock after it. The subscriber waits for the disconnect or 500ms, whichever comes first. Waiting on the disconnect alone would deadlock the fixed code, since the disconnect waits for the lock the handover holds. With the old code the disconnect answers well inside 500ms and the test fails 2 of 2 runs. A disconnect slower than that makes the test pass without covering the gap. It can't make the test fail when the code is right.
