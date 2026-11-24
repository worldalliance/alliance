---
user: Charles Lien
task: Rename the suite split feature, since too many things are already named "group"; and make clear how to clear an action's own participants and prerequisites before converting a suite.
---

# Requirements

Supersedes the terms "split" and "group" in `01a2062f-28e5-7000-982a-06ffd0477d10-suite-splits` and `01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec`. Their requirements otherwise stand, with "partition" in place of "split" and "part" in place of "group".

- The whole that sorts a suite's members is called a partition, wherever the feature names it: admin UI copy, server and client code, API fields and enum values, error messages, tests, and storage. "Split" no longer names it. (user-originated)
- The pieces of a partition are called parts, wherever the feature names them, and "group" no longer names them. (agent-proposed, user-approved)
- The UI copy for the feature is written fresh for the new terms; the user left its wording to the agent. (user-originated)
- The rename covers storage too: tables, columns and stored JSON keys are renamed directly in one migration, not through expand-migrate-contract, because no suite has been partitioned in production and none will be by the time this lands. (agent-proposed, user-approved)
- Partitioning a suite still refuses while one of its actions has its own participants or prerequisites, and the refusal says how to clear them: "Clear expression" under "Participating users", and removing each prerequisite under "Prerequisites", on each named action. (agent-proposed, user-approved)
