---
user: Charles Lien
task: Put partitioning a suite behind a feature flag, available on staging but not on production, reviving the existing feature flag file, and move the Kora staging-only tools onto it as well.
---

- Partitioning a suite is available on staging and off on production, behind a feature flag. (user-originated)
- The flag lives in the existing feature flag file, `shared/lib/features.ts` before this task. (user-originated)
- The Kora staging-only tools (deleting batches and logging completed assignments) move onto the same feature flag file. (user-originated)
- This ships as its own PR, separate from turning the button off (`01a20f95-0180-723c-bef4-d84ec0be4906-disable-suite-partitioning`). (user-originated)
- Partitioning comes back on in production once partitioned suites can launch, which ALL-2459 tracks, blocked by ALL-2178 (launch checks) and ALL-2179 (staff moves between parts). Undoing a partition isn't required first. Production's disabled button says "Partitioning is off in production until partitioned suites can launch." (agent-proposed, user-approved)
