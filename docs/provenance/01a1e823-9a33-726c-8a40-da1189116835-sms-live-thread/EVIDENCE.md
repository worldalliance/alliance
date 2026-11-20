# Evidence

Research by a Claude subagent, with a Codex subagent's citations where marked, checked 2026-11-16.

## Socket.IO

- Socket.IO middleware (`io.use`) authenticates once per connection from `handshake.auth`. Vendor documentation. https://socket.io/docs/v4/middlewares/
- Socket.IO does not guarantee delivery to a disconnected client; connection state recovery is best effort. Vendor documentation. https://socket.io/docs/v4/delivery-guarantees/, https://socket.io/docs/v4/connection-state-recovery
- A client socket doesn't reconnect by itself after a server middleware refuses its handshake, only after a low-level connection failure; it reconnects when `socket.connect()` is called. Vendor documentation, checked 2026-11-19; socket.io-client 4.8.3's `CONNECT_ERROR` handler destroys the socket's reconnect subscriptions (`build/esm/socket.js`). https://socket.io/docs/v4/client-socket-instance/#connect_error
- Socket.IO's own reconnection randomises each delay by `randomizationFactor`, 0.5 by default. Vendor documentation. https://socket.io/docs/v4/client-options/#randomizationfactor
- AWS recommends jittered exponential backoff so clients that failed together don't retry together. Vendor guidance. https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- CORS does not restrict WebSocket connections (Codex subagent). Vendor documentation. https://socket.io/docs/v4/handling-cors/

## Realtime refresh with TanStack Query

- A TanStack Query maintainer recommends socket events as invalidation signals, writing payloads to the cache only for large, frequently patched data. Vendor-adjacent (maintainer's blog). https://tkdodo.eu/blog/using-web-sockets-with-react-query
- `refetchInterval` accepts a function, so polling can slow while a socket is connected. Vendor documentation. https://tanstack.com/query/v5/docs/framework/react/reference/useQuery

## Repository measurements

Read 2026-11-16 at commit 0547cfa68f.

- The access cookie is `sameSite: "strict"` (`server/src/auth/auth.service.ts`), so a cross-site page's socket handshake carries no admin cookie.
