# Decisions

## MAIL*FROM is a GitHub \_variable*, not a secret

The user asked for "the necessary github secrets edit". A sender address is not sensitive and appears in the header of every email sent, so it goes on the Variables tab (`vars.MAIL_FROM`) rather than Secrets, alongside the existing `vars.APPLE_KEY_ID` and `vars.DOMAIN_NAME`. `dirty.txt` spells out which tab, since it changes where the change is made.

## Required only when mail actually sends

`mailSendingEnabled()` was extracted from the condition already at the top of `MailService.sendMail` and is now the single source for both that early return and `MAIL_FROM`'s required-ness in `validateEnv` (`server/src/main.ts`). The extraction preserves the original expression exactly, including its raw `process.env.NODE_ENV` string comparisons rather than the `NodeEnv` enum from `@alliance/common/node-env`: switching to the parsed enum would change behavior when `NODE_ENV` is unparseable and `SEND_DEV_NOTIFS=1`, which is outside what was asked.

Staging does not need `MAIL_FROM` — it runs `NODE_ENV=staging`, which does not send.

## Two layers of enforcement for a missing MAIL_FROM

- `validateEnv` in `server/src/main.ts` exits at boot, matching the existing `twilioSignatureEnforced()` pattern in the same set.
- `deploy.yaml` fails the production deploy before it starts, matching the `ALT_DOMAIN_NAME` guard a few lines below. Without it, a missing variable would surface only as a pm2 restart loop after a green deploy.

The `sendMail` throw is what makes `from` typed `string` without a non-null assertion, so it is not purely redundant.

`export MAIL_FROM="${{ vars.MAIL_FROM }}"` is quoted in the workflow because the value contains angle brackets, which bash would otherwise read as redirection.

## Pending row is saved before the send

`sendMail` now saves the `Pending` row with its rendered HTML before handing off to the transport, then updates it to `Sent` or `Failed`. Costs a second write per email. Taken because the audit trail is the point of the finding — a transport rejection previously left no row at all.

The transport error is still rethrown after the `Failed` row is written. Callers already expect `sendMail` to throw, and changing its signature to `Result` would ripple through roughly ten call sites for no gain here.

## Welcome email failure no longer fails registration

`createReferredUser` logs and continues. This does not conflict with the repo's "fail loudly" rule: the failure is recorded twice, in the logged error and in the `Mail` row with status `Failed`. The alternative is the current behavior, where the account is committed, registration returns 500, and the member's retry hits "User already exists" with no way forward.

`AuthService` had no logger; one was added.

## Not done

`sendPasswordResetEmail` and the other synchronous callers were left alone. Only the registration path was named in the finding the user asked to fix, and password reset has no half-committed state to strand — the caller can just try again.
