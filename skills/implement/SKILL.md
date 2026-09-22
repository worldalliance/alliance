---
name: implement
description: Read before implementing a feature, fixing a bug, or refactoring code.
---

# Implementation

Read `(root)/skills/engineering-criteria.md` and use it throughout implementation. For a feature or behavior change, follow `(root)/skills/provenance/SKILL.md`; use the supplied provenance directory when continuing a specified task.

## Discover before editing

Read the requirements and trace the existing behavior from its entry points through affected callers and contracts. Search for implementations of the same rule, including shared utilities and sibling features; inspect candidates and their callers rather than relying on names alone.

Before editing, give a short progress update naming the code to reuse or change, the consumers and contracts affected, and the checks that will establish success. For new logic, name the closest existing implementation and why it fits or needs to remain separate, or report that the search found none.

Resolve repository questions through inspection. Ask the user for missing product decisions or conflicting requirements that the available evidence cannot settle. Continue independent work while waiting.

## Implement

Check supplied design decisions against the code and requirements; revise an implementation choice when the evidence calls for it, recording the reason in the task's existing decisions file when present.

Implement through the identified owners of the behavior. When discovery during coding reveals another caller or contract, update the approach and verification to cover it.

## Verify before handoff

Read the complete resulting diff and apply every relevant engineering criterion. Compare new logic with the reuse candidates from discovery, trace affected callers, and fix supported issues introduced by the change before handing it back.

Run the required checks for affected packages and the behavioral checks identified during discovery against the final code. After repairs, rerun checks affected by those repairs. If preparing commits is requested, each commit has one purpose and passes its checks on its own; results from the branch tip alone do not establish that.

Finish when the requirements and applicable criteria are satisfied and checks pass, or identify the exact blocker and unfinished work. In the handoff, name the implementation reused or consolidated, commands and results, and remaining uncertainty. Link code and evidence rather than asserting compliance. The user's independent review remains a separate handoff.
