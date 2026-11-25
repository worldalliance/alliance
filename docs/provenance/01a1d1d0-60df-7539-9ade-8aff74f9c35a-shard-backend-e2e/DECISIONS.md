# Decisions

- **The shards are a matrix inside `test-backend-e2e.yaml`,** so `ci.yaml` and `deploy.yaml` call it unchanged and their `needs: test-backend-e2e` waits for all four. `main` has no required status checks (only a linear-history rule), so the renamed check runs block nothing. Origin: agent decision.
- **`fail-fast: false`,** as `deploy.yaml`'s `test-unit` matrix uses, so one failing shard still lets the others report their failures and timings. Origin: agent decision.
- **The shard count is written once,** in the matrix list; the command reads it from `strategy.job-total`. Origin: agent decision.
- **Per-file timings come from a JUnit report** (`--reporter=junit --reporter-outfile`), per the spec's DECISIONS.md, uploaded as a `backend-e2e-junit-<shard>` artifact even when tests fail. Origin: agent decision, from that spec.
- **The runner image is logged from `ImageOS` and `ImageVersion`,** the variables GitHub-hosted runner images set; the CPU model from `lscpu`. Origin: agent decision.
- **`--concurrency 1` is removed from `test:e2e`:** Bun 1.4.4's `bun test --help` lists no such flag (the spec's DECISIONS.md, "Consequences of the requirements"). Origin: agent decision, from that spec.
