# Evidence

Research by a Claude subagent, with a Codex subagent's citations where marked, checked 2026-11-16.

## Socket.IO

- Socket.IO middleware (`io.use`) authenticates once per connection from `handshake.auth`. Vendor documentation. https://socket.io/docs/v4/middlewares/
- CORS does not restrict WebSocket connections (Codex subagent). Vendor documentation. https://socket.io/docs/v4/handling-cors/

## Repository measurements

Read 2026-11-16 at commit 0547cfa68f.

- The access cookie is `sameSite: "strict"` (`server/src/auth/auth.service.ts`), so a cross-site page's socket handshake carries no admin cookie.
