import { draftFetchState } from "./draftFetchState";

const pending = {
  isEnabled: true,
  fetchStatus: "fetching",
  isPending: true,
  failureCount: 0,
} as const;

it.each([
  ["while the first fetch runs", pending, { settled: false, failed: false }],
  [
    "while idle before any data lands",
    { ...pending, fetchStatus: "idle" },
    { settled: false, failed: false },
  ],
  [
    "while a refetch runs over data",
    { ...pending, isPending: false },
    { settled: false, failed: false },
  ],
  [
    "once the fetch lands",
    { ...pending, fetchStatus: "idle", isPending: false },
    { settled: true, failed: false },
  ],
  [
    "while the fetch waits offline",
    { ...pending, fetchStatus: "paused" },
    { settled: false, failed: true },
  ],
  [
    "while a failed attempt retries",
    { ...pending, failureCount: 1 },
    { settled: false, failed: true },
  ],
  [
    "once the fetch fails",
    { ...pending, fetchStatus: "idle", isPending: false, failureCount: 1 },
    { settled: true, failed: true },
  ],
  [
    "while off",
    { ...pending, isEnabled: false, failureCount: 1 },
    { settled: true, failed: false },
  ],
] as const)("%s", (_, query, expected) => {
  expect(draftFetchState(query)).toEqual(expected);
});
