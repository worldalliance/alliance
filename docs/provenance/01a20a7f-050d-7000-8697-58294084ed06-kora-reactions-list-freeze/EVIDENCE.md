# Evidence

## Firefox profile

Method: the user recorded Firefox's profiler on staging while a long transcript hung, 2026-11-23. Inverted, 61% of samples were in `Element.getBoundingClientRect`, under the minified `lines()` word loop, called from `groups()` through the `blockOf` helper and `Array.filter`, from `renderReactionList`, from `renderReactions` in a `requestAnimationFrame` callback.

## Layout reads per reaction

Method: `kora-review` mounted alone on a test page in Playwright 1.59.1's Chromium 1217, with the example transcript's first chatbot reply replaced by 60 paragraphs of about 47 words each, `Element.prototype.getBoundingClientRect` wrapped in a counter, and four reactions given from the keyboard (ArrowDown, then 1 or 2). 2026-11-23, on branch `kora-single-chatbot` at `0d1a9418a`, whose `reaction-list.ts` matches `main` at `6cbd7ffd2`.

| Code | Reads per reaction | Time per reaction |
| --- | --- | --- |
| Before | about 118.9 million | 38–39 s |
| After | 48,035–81,887 | 22–43 ms |
