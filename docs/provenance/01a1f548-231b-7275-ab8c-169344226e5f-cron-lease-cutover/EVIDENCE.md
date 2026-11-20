# Evidence

## Shutdown under Bun

On 2026-11-19, local, this branch.

- A Nest 11.1.17 Express app under Bun 1.4.4 held a request across `app.close()` and released it 100 ms later: the response arrived at 104 ms and `close()` resolved at 6105 ms, while the keep-alive connection timed out. With `configureApp`'s middleware closing idle connections after each response once the server stopped listening, `close()` resolved at about 106 ms over three runs.
