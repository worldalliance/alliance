# Engineering criteria

Apply each criterion where the change affects it, alongside the repo's `AGENTS.md` rules.

1. **Intent & scope** — the change satisfies the requirements; each changed line serves that purpose.
2. **Correctness** — logic, error paths, boundary conditions, concurrency/async hazards, backward compatibility, and public API contracts hold for affected callers. Passing tests supplement execution tracing, especially for races and external dependencies.
3. **Maintainability** — the same rule has one implementation where callers can share it; similar-looking code with different contracts stays separate. Responsibilities belong in the layer that owns the behavior. Choose the simplest design or root-cause fix that meets the demonstrated requirements and preserves relevant invariants. Justify broader changes with concrete requirements, weighing cost and risk. Added generality serves a current need. If correctness depends on an undocumented invariant, express it through types, structure, or tests, with a comment for constraints those cannot express.
4. **Security & privacy** — trace sources → validation/transformation → sinks (db, filesystem, UI rendering, logs, external calls). Check injection, unsafe deserialization, authn/authz gaps, secrets and PII handling, and unsafe logging.
5. **Reliability** — account for failure modes, retries, timeouts, idempotency, and resource cleanup; provide logs/metrics/traces where they matter, carrying no secrets or PII.
6. **Tests** — use coverage appropriate to the behavior (unit/integration/e2e). Inspect assertions and mocks: would the tests detect the defect, or do they bypass the relevant behavior? When useful, verify this against the old implementation or by temporarily reintroducing the defect, restoring the code afterward. Close concrete coverage gaps with the smallest useful set of tests.
7. **User experience & documentation** — exercise relevant loading, empty, error, and keyboard states for UI changes. Changes to build, usage, testing, or release workflows include updates to the associated instructions.
