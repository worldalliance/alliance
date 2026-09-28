# Flaky unit tests

Status: merged in PR #262. Fixes ALL-1200 and ALL-1223.

## Which tests were flaky

The candidates came from the failed CI and Deploy runs between Aug 10 and Sep 28, 2026. Two tests failed repeatedly with no related code change:

- `apps/frontend/src/components/Comments.test.tsx`, "leaves focus alone for a press that was never on the control": 9 failures since Sep 9, each a timeout of 4.6–6.1 s against bun's 5 s limit.
- `shared/forms/timeZoneSelect.test.ts`, "builds no formatter on open once the runtime has been idle": 3 failures since Sep 25. Opening the picker built 1–2 more formatters than the expected 838.

Every other failure in that window was a real breakage fixed by a later commit.

## Reproducing on CI runners

Neither test failed locally: not in isolation, not under `TZ=UTC`, and not in full suites with the CPU saturated. A throwaway branch (`flaky`, since deleted) ran a workflow that looped each package's full suite 20 times in each of 10 parallel `ubuntu-latest` jobs, with bun 1.3.6. Full suites rather than single tests, because both flakes could have depended on earlier tests. Both tests carried temporary logging that printed only on failure. Each flake reproduced within a few runs.

## Comments test: a failed matcher printed a DOM node

The test ends with `waitFor(() => expect(queryByRole("group", …)).toBeNull())`. Usually the group is gone at the first check. When it is still there for one more tick, `toBeNull` fails and bun builds a message that prints the received happy-dom node. bun's default inspection walks the node's document, window and React fiber properties: 19.9 MB of text for an empty `<div>` locally, and about 5 s of CPU on a runner with the Comments DOM.

Evidence from the runners:

- A heartbeat timer saw the event loop stall for 5.4–5.7 s after the comments rendered. The process used about as much CPU as the stall lasted, and the comment components did not re-render, so the process was busy rather than blocked, and React was not looping.
- JSC's sampling profiler (`bun:jsc` `startSamplingProfiler`; `bun --cpu-prof` writes nothing under `bun test`) put 5,089 of the 5,108 samples during the stall inside `toBeNull`, under `waitFor`'s `checkCallback`. The heap grew from 37 MB to 479 MB.

The fix went into `shared/lib/testing/preload.ts` rather than the one test, because any failing matcher on a DOM node costs the same. That file is the DOM preload for `shared`, `sharedweb`, `apps/frontend` and `apps/admin`. It gives `Node.prototype` a `Bun.inspect.custom` that prints an element as its `outerHTML` and any other node as its `nodeName`. The same failure then builds a 95-character message in 0 ms, and the message reads better. `shared/lib/testing/preload.test.ts` fails without the change.

## Timezone test: pickers from earlier tests stayed mounted

`timeZoneSelect.test.ts` had no `afterEach(cleanup)`. Testing Library registers its automatic cleanup in only one test file per process, so each file that renders has to register it itself. Logging on the runners showed the extra build was `offset:Etc/GMT+8`, called from the `selected` memo in `shared/forms/timeZoneSelect.ts`. This test's picker uses the default zone, so the build came from a picker an earlier test left mounted, such as `renderOpen({ value: "Etc/GMT+8" })`. Now and then that picker re-rendered inside this test's `act()`, after `resetTimeZoneCaches()`, and rebuilt formatters that landed in this test's count. The fix is `afterEach(cleanup)` in that file.

Whether the leftover picker re-renders inside the `act()` depends on scheduler timing on the runner. The exact trigger was never reproduced locally, so the fix was verified by looping on the runners.

## Rejected explanations

- ALL-1200 suggested that the warm-up step's ~8 ms cap left zones unlabelled. The test runs the step with `timeRemaining: Infinity` and `didTimeout: false`, so the step never stops early.
- A minute boundary between warm-up and open, the formatter-cache state at 400 random instants across a year, and `act()` flushing another root's default-lane update all built no extra formatter in deterministic local tests.
- For the Comments test: fake timers leaking from other files (Comments runs first and no frontend test uses fake timers), react-query retries (the hook does not use react-query), and a synchronous block such as a DNS timeout (ruled out by the CPU measurement).

## Verification

- With the fixes, each package's full suite passed 200 of 200 times on the runners (`shared`: run 36462191856; `apps/frontend`: run 36463095443). Before the fixes, `shared` failed twice and `apps/frontend` three times across the loop runs.
- On the PR branch, `bun run test shared sharedweb apps/frontend apps/admin`, the `shared` typecheck, format check and dupcheck all passed.

## Not addressed

`ResetPasswordPage.test.tsx` prints thousands of lines of a happy-dom window into CI logs. It did not cause either flake. The same inspection hook is likely to shorten that output, but this was not checked.
