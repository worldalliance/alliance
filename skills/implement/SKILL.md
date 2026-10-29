---
name: implement
description: Read before implementing a feature, fixing a bug, refactoring code, or verifying any change.
---

# Implementation

For verification-only work, go directly to **Checks**.

Read `(root)/skills/engineering-criteria.md` and use it throughout implementation. Follow `(root)/skills/provenance/SKILL.md`.

## Discover before editing

Read the requirements and trace the existing behavior from its entry points through affected callers and contracts. Search for implementations of the same rule, including shared utilities and sibling features; inspect candidates and their callers rather than relying on names alone.

Before editing, give a short progress update naming the code to reuse or change, the consumers and contracts affected, and the checks that will establish success. For new logic, name the closest existing implementation and why it fits or needs to remain separate, or report that the search found none.

Before writing code, ask the questions the request leaves open, such as a missing product decision or conflicting requirements, per **Open questions** in the root `AGENTS.md`. A request that leaves none open goes straight to implementation.

## Implement

Loop until the checks named in that progress update pass. A bug fix starts with a test that reproduces the bug. A refactor runs the suite green before and after. Adding validation means tests for the invalid inputs, then the code that passes them.

Check supplied design decisions against the code and requirements; revise an implementation choice when the evidence calls for it, recording the reason in the task's `DECISIONS.md` when it has a provenance directory, creating the file if needed.

Implement through the identified owners of the behavior. When discovery during coding reveals another caller or contract, update the approach and verification to cover it.

## Verify before handoff

Read the complete resulting diff and apply every relevant engineering criterion. Compare new logic with the reuse candidates from discovery, trace affected callers, and fix supported issues introduced by the change before handing it back.

Run the checks under **Checks** that the change touches and the behavioral checks identified during discovery against the final code. After repairs, rerun checks affected by those repairs. If preparing commits is requested, each commit has one purpose and passes its checks on its own; results from the branch tip alone do not establish that.

Finish when the requirements and applicable criteria are satisfied and checks pass, or identify the exact blocker and unfinished work. In the handoff, name the implementation reused or consolidated, commands and results, and remaining uncertainty. Link code and evidence rather than asserting compliance. The user's independent review remains a separate handoff.

## Checks

### Typechecking

Run typechecking for affected packages that provide a typecheck script, following the root `AGENTS.md` Typechecking rule.

### Testing

`bun run test` from the repo root; scope by package: `bun run test apps/admin sharedweb`. From inside a package, run bare `bun test`.

### Duplication

`bun run dupcheck` from the repo root after a change, alongside typecheck. It lists copied code, and text of five or more words repeated verbatim, that the working tree has and its merge-base with `origin/main` doesn't. Matches are exact, so it errs both ways. Some hits look alike but should stay separate, or are an edit inside existing duplication; judge each. It misses the same rule or message written differently, so a clean run leaves the search for an existing implementation still yours to do.

The purpose of deduplication is to put things that should change together in one place. Reducing repeated code is a useful side effect, not the goal. Deduplicate when a future change should naturally apply to all copies together; keep things separate when they are likely to evolve independently.

### Coverage

`bun run covercheck` from the repo root after a change that adds logic. It lists lines the working tree changed since its merge-base with `origin/main` that no unit test ran, and changed files no test loads. It runs the tests of each package it touched, or of every package once it touches `common`, `shared`, or `sharedweb`. A reminder, not a gate: judge each gap and add a test where one would catch a regression.

### Formatting

`bun run format [FILE...]` from the repo root, all files when none are named; `bun run format:check [FILE...]` to only report.

### Workflows

`actionlint` from the repo root after editing `.github/workflows/`; CI and deploys fail on its findings. Without `shellcheck` on `PATH` it skips the shell in `run:` blocks and still passes; `brew install actionlint shellcheck`.

`shellcheck .github/actions/*/*.sh .github/scripts/*.sh scripts/deploy_backend.sh` after editing any of them; actionlint skips those scripts, and CI and deploys run it too.
