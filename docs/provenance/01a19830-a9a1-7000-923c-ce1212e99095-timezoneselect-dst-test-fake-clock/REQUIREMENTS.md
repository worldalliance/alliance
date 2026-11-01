---
user: Charles Lien
task: Fix the date-dependent timeZoneSelect DST offset test (ALL-1954)
---

# Requirements

- The test "the offset a zone sorts by > follows one a picker sat mounted through" in `shared/forms/timeZoneSelect.test.ts` passes whatever the real date is, so `bun test` in `shared` is green year-round. (User-originated, from Linear issue ALL-1954.)
- The test keeps asserting what it asserts today: a picker that is open across the 2026-03-08 10:00 UTC daylight-saving change rebuilds its list and sorts America/Los_Angeles by -420 rather than -480. (Agent-proposed, user-approved.)
