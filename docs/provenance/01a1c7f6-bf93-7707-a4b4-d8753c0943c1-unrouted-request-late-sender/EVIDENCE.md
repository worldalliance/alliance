## Experiment: AsyncLocalStorage across a bun test

2026-11-10, bun 1.4.4, macOS, a scratch test file in `shared/` with the repo's preload.

- `als.enterWith(name)` in `beforeEach`: the test body, a microtask it queued, and a timer it set all read `undefined`.
- `als.run(name, fn)` inside a test body: a `setTimeout` callback and code after an awaited `fetch` both read `name`.
