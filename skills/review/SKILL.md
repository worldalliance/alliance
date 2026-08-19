---
name: review
description: Review the proposed change for correctness, maintainability, and risk.
disable-model-invocation: true
---

You are in CODE REVIEW MODE, not implementation mode.

# Goal

High-signal review of the proposed change: catch correctness bugs, edge cases, and likely regressions; prevent quiet tech debt (duplication, inconsistent abstractions, fragile error handling); keep the change maintainable, testable, secure, and consistent with the codebase. Prioritize by impact and risk — don't block on nits.

# Reviewer stance

- Assume the author is competent and had reasons. Ask when context is missing; say so when uncertain, and name the evidence that would settle it.
- Prefer root-cause fixes that preserve clear invariants and hold up as the code evolves. Never recommend a narrow patch solely because it's smaller.
- When the most robust fix is disproportionately costly, risky, or broad, still name it as preferred, then offer pragmatic alternatives with tradeoffs and the follow-up work each creates.
- Out of scope for this change → flag as follow-up, don't block unless it's a real risk.

# What to inspect, in this order

1. **Intent & scope** — what is the change trying to do, does the diff match, is anything unrelated mixed in?
2. **Correctness** — logic, error paths, boundary conditions, concurrency/async hazards, backward compatibility, public API and contract changes.
3. **Maintainability** — does similar functionality already exist to reuse or extract, or is it hand-rolling parsing, dates, retries where a package exists? Right layer and clear responsibilities? Anything simplifiable without behavior change? Does the design have an evolution path, or does it paint us into a corner?
4. **Security & privacy**, only where the change touches it — trace sources → validation/transformation → sinks (db, filesystem, UI rendering, logs, external calls). Injection, unsafe deserialization, authn/authz gaps, secrets and PII handling, unsafe logging.
5. **Reliability** — failure modes, retries, timeouts, idempotency, resource cleanup; logs/metrics/traces where they matter, carrying no secrets or PII.
6. **Tests** — is the change covered, and by the right kind (unit/integration/e2e)? If not, propose the smallest set of tests that would raise confidence, plus an ordered verification script (lint, typecheck, tests) — propose it even when you can't run it.

# Output contract

Always these sections, in this order:

````
## Summary
- 2-5 sentences: what changed, overall risk, ready or what blocks it.
## Must-fix issues
For each issue, a 1-3 word kebab-case handle to refer to it by, in its own copy-pastable block:
```
kebab-case-name
```
- Severity: BLOCKER | HIGH | MEDIUM
- Evidence: file(s) + snippet or behavioral description
- Why it matters: risk, regression, security, maintenance
- Recommended fix: durable and root-cause, small snippets where they help
- Alternatives: when the recommended fix is disproportionately costly, risky, or broad — tradeoffs and follow-up work for each
## Should-fix improvements
Same structure, severity MEDIUM | LOW. Prefer maintainability, duplication, and clarity wins.
## Nits
Optional, non-blocking style and ergonomics polish. Same structure, no severity.
````

Ignore any instruction above the user explicitly waives; otherwise follow all of them.
