# Decisions

Agent decisions unless marked otherwise. Sources are in `EVIDENCE.md`.

## File layout

- `mms.service.ts` would pass 500 lines once its saves announce thread changes, so Twilio status refresh (`refreshMmsData`) moved to `TwilioStatusWorker`, its only production caller, which fetches through `MmsService.fetchMessage`. The three send paths stay together, since they share dispatch, timeout, late-send recording and alerting. A Claude subagent's split suggestion stood in for Codex's, which was out of usage.

## Session refresh

- `refreshSession` signs the user out only when the server refuses the refresh with 401, the only refusal its refresh route sends. Any other answer, a 403 from a proxy in between included, or a refresh that couldn't be sent, fails the request instead, since signing out over a server error or a dropped connection discards the page for a session that may be fine.

## Transport

- The handshake is refused in `io.use` middleware unless the token's session is current and its account is an admin, and it fails closed when that check errors. The event-log gateway instead checks admin after connecting, and the shared `socketAuthMiddleware` accepts a verified token when the session check errors; neither suits a feed of every member's thread activity. A check that errors refuses with "Unavailable" and logs an error, so clients retry instead of refreshing a session that is fine, and an outage doesn't read as expired tokens.
- `MessagingConnectionConfig` accepts `onRefreshToken` without `getAuthToken`, so a socket that authenticates with the session cookie can refresh the cookie and reconnect after a refused handshake. This supersedes the decision in `01a0a70c-f48e-7000-9a50-d85aa6870b39-mobile-oauth-login/DECISIONS.md` that the config requires `getAuthToken` whenever a refresh callback is supplied; the refresh contract is otherwise unchanged. A socket without `getAuthToken` that has `onRefreshToken` opens its own connection rather than sharing one with the tab's other sockets on that origin, since Socket.IO sends cookies only with a connection's opening request and a shared one would retry a refused handshake with the old cookie. A cookie socket that never refreshes, such as the frontend's, keeps sharing, so it costs no extra connection.
- Every messaging socket retries a handshake refused as "Unavailable", backing off from one second to thirty as the token refresh does, with each delay jittered by up to half either way so sockets refused by one outage don't retry in lockstep, because Socket.IO doesn't retry a refusal from middleware and a database blip would otherwise leave the socket down until the page reloads.
