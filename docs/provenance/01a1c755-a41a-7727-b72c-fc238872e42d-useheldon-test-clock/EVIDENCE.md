## Measurements

Method: from `shared/`, 40 concurrent `bun test lib/useHeldOn.test.tsx` runs per batch while four `yes > /dev/null` processes per core load the CPU. macOS, Bun 1.4.4, 2026-11-10.

- On `main` at `c609f1e189`: 0 failures in 40 runs. Lengthening the newest-raise test's 40 ms wait to 65 ms, past its 60 ms hold, fails it with `Expected: true, Received: false`, the failure ALL-1859 reports.
- With only the newest-raise test pinned: 2 failures in 40, both "holds on after a flag that drops at once" at line 18, after 73 ms and 122 ms.
- With both tests pinned: 0 failures in 120.
- Against a hook that keeps the first raise's timestamp (`if (!held) raisedAt.current = Date.now();`), the previous newest-raise test passes and the rewritten one fails.
