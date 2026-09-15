# Decisions

## Every refusal is a 401, and a broken signup is a 500 carrying its own error

`authenticate` returns the member-side refusals (no account, invite required, unverified email, a provider account held elsewhere) and throws anything else, such as a database error. `/native` answers each refusal with a 401 and its message, and lets a throw through. Nest answers that with a 500, and `PosthogExceptionFilter` reports the error itself, stack and all. The body says "Internal server error", as a 5xx does on every route, and `refusalMessage` in `common/src/errorMessage.ts` already swaps a 5xx body for the client's own fallback.

Refusals are thrown as `UnauthorizedException`. `PosthogExceptionFilter` skips that class but reports a bare `HttpException` carrying 401, so a status alone would file every member turned away as a server exception.

Rejected: 403 for the refusals. Mobile shows the message whatever the status, and `/auth/login` answers a refused password with 401 too.

Rejected: catching the throw and rethrowing an `InternalServerErrorException` with the `Failed` message and the error as its `cause`. Nest's filter logs only exceptions that aren't an `HttpException`, so the error would drop out of the console, and the body would carry a message no other 5xx does.

## A token the provider won't vouch for is a 401 with the `Failed` message

Without a message the body says "Unauthorized", which mobile puts on the member's screen as is. `Failed` is what the browser callback shows when its code exchange breaks. It is a 401 rather than a 500, since an expired or forged token is the caller's.

## Each id token is accepted once

A verified token is spent before `authenticate` runs, so a copy of it, or the same request sent again, gets the `Failed` 401. The token is spent even when the member is refused (no account, say), so a client asks its SDK for a new token on every attempt.

`OAuthAuthService` keeps a SHA-256 of each spent token in memory until its `exp` plus five minutes, the clock skew google-auth-library allows. By then the verifier refuses it anyway. A token with no `exp` is refused, since there would be no point at which to forget it.

The server runs as one pm2 process. A restart forgets the spent tokens, so a token used just before a deploy is good again until it expires.

Rejected: a nonce. The free `@react-native-google-signin` API has no way to set one, so it could only cover Apple, and once tokens are spent it adds cover only for a copy used before the app presents its own.

Rejected: a database table of spent tokens. It would survive a restart, but it needs a migration and a sweep for rows that stop mattering once the token expires.

## A blank name is refused

`name` is trimmed and has to be non-empty, as on `/auth/register`. The app sends no name rather than a blank one, so only a hand-built request gets the 400.

Rejected: treating a blank name as absent, which names the member after their email and hides the client's bug.
