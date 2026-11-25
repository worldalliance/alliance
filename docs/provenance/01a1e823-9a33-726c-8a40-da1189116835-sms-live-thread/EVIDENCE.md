# Evidence

Research by a Claude subagent, with a Codex subagent's citations where marked, checked 2026-11-16.

## Collision detection in helpdesk products

Question: what do shared-inbox products show when another agent is working a conversation, and do they block or warn?

- Help Scout shows a yellow (viewing) or red (replying) icon on list rows and avatars in the conversation; a reply is paused when another user replied or added a note, or a customer reply arrived unseen, and can be sent anyway or discarded. Vendor documentation. https://docs.helpscout.com/article/99-traffic-cop
- Zendesk shows an eye icon in lists and viewer/editor avatars in a ticket; it warns only. Vendor documentation. https://support.zendesk.com/hc/en-us/articles/4408825035674
- Freshdesk shows who is viewing or replying, has no lock, and a separate Traffic Cop that stops replies that missed updates. Vendor documentation. https://support.freshdesk.com/solution/articles/218076, https://support.freshdesk.com/support/solutions/articles/237553
- Front shows teammates replying and shares drafts live. Vendor documentation. https://help.front.com/en/articles/2403
- No formal standard and no published usability research on collision UI was found. Common practice is two or three states shown as header avatars plus a list icon, warning rather than locking.

## Typing and presence protocols

- XMPP XEP-0085 defines `composing` and `paused` chat states, with the pause interval given only as an example. Formal standard (XSF). https://xmpp.org/extensions/xep-85.html
- Matrix typing notifications carry a `timeout` the client refreshes before expiry. Formal standard (Matrix spec). https://spec.matrix.org/latest/client-server-api/#typing-notifications
- Twilio Conversations throttles typing signals to one per 5 seconds by default. Vendor documentation. https://www.twilio.com/docs/conversations/typing-indicator

## Socket.IO

- Socket.IO middleware (`io.use`) authenticates once per connection from `handshake.auth`. Vendor documentation. https://socket.io/docs/v4/middlewares/
- Several Socket.IO nodes need sticky sessions plus an adapter such as Redis. Vendor documentation. https://socket.io/docs/v4/using-multiple-nodes/
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

- Production runs one backend process (`scripts/deploy_backend.sh`), and `server/src/main.ts` configures no Socket.IO adapter, so rooms and in-memory state are process-local.
- The access cookie is `sameSite: "strict"` (`server/src/auth/auth.service.ts`), so a cross-site page's socket handshake carries no admin cookie.
- Phone numbers are not yet unique across live accounts in the database (`server/src/user/entities/user.entity.ts`, TODO(ALL-2259)), though new writes refuse a number another live account holds.
