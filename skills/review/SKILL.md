---
name: review
description: Review the proposed change for correctness, maintainability, and risk.
disable-model-invocation: true
---

# Goal

High-signal review of the proposed change: catch correctness bugs, edge cases, and likely regressions; prevent quiet tech debt (duplication, inconsistent abstractions, fragile error handling); keep the change maintainable, testable, secure, and consistent with the codebase.

# Reviewer stance

- Ask when context is missing; say so when uncertain, and name the evidence that would settle it.
- Prefer root-cause fixes that preserve clear invariants and hold up as the code evolves. Never recommend a narrow patch solely because it's smaller.
- When the most robust fix is disproportionately costly, risky, or broad, still name it as preferred, then offer pragmatic alternatives with tradeoffs and the follow-up work each creates.

# What to inspect

1. **Intent & scope** — what is the change trying to do, does the diff match, is anything unrelated mixed in?
2. **Correctness** — logic, error paths, boundary conditions, concurrency/async hazards, backward compatibility, public API and contract changes.
3. **Maintainability** — does similar functionality already exist to reuse or extract, or is it hand-rolling parsing, dates, retries where a package exists? Right layer and clear responsibilities? Anything simplifiable without behavior change? Does the design have an evolution path, or does it paint us into a corner?
4. **Security & privacy**, only where the change touches it — trace sources → validation/transformation → sinks (db, filesystem, UI rendering, logs, external calls). Injection, unsafe deserialization, authn/authz gaps, secrets and PII handling, unsafe logging.
5. **Reliability** — failure modes, retries, timeouts, idempotency, resource cleanup; logs/metrics/traces where they matter, carrying no secrets or PII.
6. **Tests** — is the change covered, and by the right kind (unit/integration/e2e)? If not, propose the smallest set of tests that would raise confidence, plus an ordered verification script (lint, typecheck, tests) — propose it even when you can't run it.

# Verify every claim

Every finding is a claim about behavior, and an untested claim is a guess. Before a finding reaches the output, make the defect observable: run the input that breaks it, write a script that fails, take screenshots, query the db, trace the call path back to a real caller, etc.

Some claims resist testing (an external service, a race, a migration against production data). Report those as unverified and name what would settle it.

# Tiers

- **Must-fix** — shipping it is wrong. Wrong behavior on a reachable path, data loss, a security or privacy hole, a regression, a broken contract, or a repo rule the build won't catch. The author changes the code before merge.
- **Should-fix** — it works, but someone pays for it later. Duplication, wrong layer, a fragile error path, an abstraction the next change will fight, a real case with no test. The author picks: fix now, or file a follow-up.
- **Nit** — taste. Naming, ordering, a shorter way to write the same thing. No effect on behavior or on the next change. The author can ignore it without replying.

Out of scope for this change → should-fix, phrased as a follow-up, unless it is a real risk.

Torn between two tiers, take the lower one. A must-fix the author talks you out of costs more than a should-fix they promote.

# Voice

Write like one engineer talking to another. The plainest word for each idea, short sentences, no jargon where a common word does the job. A finding the author has to read twice is a finding they skip.

# Output contract

Always these sections, in this order. A section with nothing to report says `None`. The tier is the severity, so no finding carries a separate severity label.

```
## Summary

2-5 sentences: what the change does, how risky it is, and whether it's ready or what blocks it.

## Must-fix

Most severe first. Each finding is a subsection headed by a 1-3 word kebab-case handle to refer to it by:

### `kebab-case-name`

Severity: BLOCKER | HIGH

A sentence or two stating the defect, readable on their own, then what it costs: the regression, the data at risk, the work it creates later.

Where it lives (`path/file.ts:42`, plus a snippet where that helps) and how you checked. Name the command, test, or query you ran and what it returned.

**Fix:** the root-cause one, with a snippet where it helps. When that fix is disproportionately costly, risky, or broad, still name it first, then the cheaper options and the follow-up work each one leaves behind.

## Should-fix

Same shape, severity MEDIUM | LOW.

## Nits

Same shape, no severity.
```

Ignore any instruction above the user explicitly waives; otherwise follow all of them.
