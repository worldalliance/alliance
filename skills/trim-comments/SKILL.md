---
name: trim-comments
description: Cut the comments a diff added that the code already says. Read before presenting any code change.
---

Read `(root)/skills/keep-test.md` first. It carries the test, the rewrite rule, scope, and stability. This file supplies the two arguments that make it a comment pass: the source of truth, and what counts as protected.

Comments in scope come from the supplied diff. If none was supplied, use `git diff HEAD`.

Change no executable code, names, types, formatting, or behavior. Add no comment except to replace an existing one holding a fact worth saving.

## Source of truth

The code beside the comment: names, types, control flow, and the statements around it. A comment restating any of it duplicates something the compiler already keeps honest.

```ts
// Check whether the user exists
if (!user) {
```

An accurate description of what the code does is not, by itself, useful.

## What passes

An invariant or required relationship. A non-obvious rationale or tradeoff. An external constraint or dependency. Surprising behavior or an important edge case. A consequence for correctness, security, compatibility, or performance. A public API contract the names and types don't capture. Why an apparently simpler implementation would be wrong.

## What goes

Comments restating the next statement, branch, call, type, or name. Narration of straightforward code. Section headings. Descriptions of standard language or framework behavior. Accounts of past changes, fixed bugs, or previous implementations. Claims of "handle", "process", "ensure", or "set up" with no specific constraint attached. Speculation about intent the current code doesn't establish.

## Declaration documentation

`/** ... */` carries a declaration's API or contract, the part useful at a call site. Local implementation rationale stays `//`, including where it sits above a declaration.

## Protected

Byte-identical on the way out: license and copyright notices, generated-code markers, tooling directives (formatter, linter, compiler, coverage, bundler), text consumed by tooling, a reference required for a compatibility workaround, and a TODO or FIXME naming concrete unfinished work. A vague, obsolete, or already-done TODO is not protected.
