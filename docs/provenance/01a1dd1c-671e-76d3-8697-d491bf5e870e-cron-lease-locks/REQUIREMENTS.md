---
user: Charles Lien
task: Spec the longer-term fix for the cron connection-pool deadlock that the hotfix in docs/provenance/01a1dcda-00fe-72c8-833d-6d724a5377c9-raise-db-pool-size only made unreachable.
---

# Requirements

1. Design a longer-term fix for the cron jobs that hold a pooled database connection for their lock while taking more connections from the same pool. The hotfix that raised the pool size stays in place. (User-originated.)
2. The server will eventually run as more than one process (horizontal scaling), though not soon. The fix must not need rewriting when that happens. (User-originated.)
3. The size of a code change is not a cost to weigh. Options are judged on correctness, operational risk and fit. (User-originated.)
4. Base the design on researched established practice, and get an independent second opinion on the research and on each design question. (User-originated.)
5. Write no code for this until the user asks for implementation. (User-originated, through the `/spec` command.)
