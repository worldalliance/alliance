# Evidence

## Bun's `app.close()` with an open connection (2026-11-10, Bun 1.4.4, macOS)

Method: a Nest app on `listen(0, "127.0.0.1")`, a raw `node:net` socket to it, then `app.close()` raced against a 2 s timer.

- Idle socket that never sent a request: `app.close()` resolves.
- Keep-alive socket after a completed request: `app.close()` resolves.
- Socket whose request the handler is still answering: `app.close()` hangs until the timer fires. With `getHttpServer().closeAllConnections()` first, it resolves.
