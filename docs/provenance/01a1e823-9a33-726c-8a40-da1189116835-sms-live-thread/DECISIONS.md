# Decisions

Agent decisions unless marked otherwise. Sources are in `EVIDENCE.md`.

## Transport

- The handshake is refused in `io.use` middleware unless the token's session is current and its account is an admin, and it fails closed when that check errors. The event-log gateway instead checks admin after connecting, and the shared `socketAuthMiddleware` accepts a verified token when the session check errors; neither suits a feed of every member's thread activity. A check that errors refuses with "Unavailable" and logs an error, so clients retry instead of refreshing a session that is fine, and an outage doesn't read as expired tokens.
