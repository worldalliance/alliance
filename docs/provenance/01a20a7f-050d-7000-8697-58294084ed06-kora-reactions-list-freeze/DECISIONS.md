# Decisions

- **Measure a reply's lines once per pass in the reactions list.** `groups()` and `passageContext()` in `kora-review/src/engine/reaction-list.ts` looked up each line's paragraph through a helper that called `lines(v)` per lookup, and `lines(v)` reads every word's `getBoundingClientRect`. That made one render cost paragraphs × lines × words layout reads (EVIDENCE.md, **Firefox profile** and **Layout reads per reaction**). The helper now takes the already measured lines. Agent decision.
- **The `dmn_chk_…` cookie warning is left alone.** posthog-js sets that cookie for 3 seconds on each parent domain to find the widest one that accepts cookies, and Firefox logs each rejected attempt; it does not affect the page. Agent decision.
- **Caching `lines(v)` across a whole render is left out.** After the fix a reaction still measures a reply's words about 19 times, which is linear in words and took under 50 ms on a 2,800-word reply. Agent decision, per YAGNI.
- **A regression test counts layout reads per reaction** (`kora-review/test/mount-review.test.ts`), bounded at 25 per word, so a lookup that re-measures per line fails it. Agent decision.
