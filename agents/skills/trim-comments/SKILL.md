---
name: trim-comments
description: Cut the comments. Read before presenting any code change.
---

# Trim comments

Comments have a very high bar. A good pass leaves only comments that tell a reader something the code beside them can't: a constraint, the reason behind code that looks wrong, an invariant, an edge case, or a caller's contract. On code whose comments already meet that bar, change nothing.

Change no executable code, names, types, formatting, or behavior. Add no comment except to replace an existing one holding a fact worth saving.

## The test

Keep a comment only when all four hold:

1. It states a concrete fact the code in the same file (names, types, control flow, the statements around it) doesn't already carry.
2. Nothing nearby, such as another comment or the declaration's doc, already says it more clearly.
3. That fact changes what a reader does next: delete the comment and you can name what they now do differently.
4. That fact is true now.

Otherwise delete it. Harmless, or useful one day, is not a reason to keep. A comment your change added earns its place like any other. An accurate restatement still fails:

```ts
// Check whether the user exists
if (!user) {
```

What fails the test:

- **[Common pitfall]** accounts of past changes, fixed bugs, or previous implementations.
- Restating the next statement, branch, call, type, or name.
- Narration of straightforward code, and section headings.
- Descriptions of standard language or framework behavior.
- "Handle", "process", "ensure", or "set up" with no specific constraint attached.
- Speculation about intent.

A comment that fails goes whole; shaving words off it leaves a worse sentence. Rewrite only to save a fact that passes but arrives worded as history, misleading, ambiguous, or far longer than it needs to be, and never invent a rationale, risk, or constraint the surroundings don't support. State the constraint that holds now, not the history that produced it:

```ts
// We used to sort this differently, but it caused duplicate notifications.
// →
// Keep oldest-first ordering so retries cannot skip an earlier notification.
```

## Scope and stability

The pass covers the comments your change touched, plus any it made false or misleading. A comment that passes and needs no rewrite keeps its wording, format, and place, on this run and every repeat run.

## Declaration documentation

`/** ... */` carries a declaration's API or contract, the part useful at a call site. Local implementation rationale stays `//`, including where it sits above a declaration.

## Protected

Byte-identical on the way out: license and copyright notices, generated-code markers, tooling directives (formatter, linter, compiler, coverage, bundler), text consumed by tooling, a reference required for a compatibility workaround, and a TODO or FIXME naming concrete unfinished work. A vague, obsolete, or already-done TODO is not protected.
