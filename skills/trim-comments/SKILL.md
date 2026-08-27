---
name: trim-comments
description: Cut the comments. Read before presenting any code change.
---

Read `(root)/skills/keep-test.md` first. It carries the test, the rewrite rule, scope, and stability. This file supplies the two arguments that make it a comment pass: the source of truth, and what counts as protected.

Change no executable code, names, types, formatting, or behavior. Add no comment except to replace an existing one holding a fact worth saving.

## Source of truth

The code beside the comment: names, types, control flow, and the statements around it. A comment restating any of it duplicates something the compiler already keeps honest.

```ts
// Check whether the user exists
if (!user) {
```

An accurate description of what the code does is not, by itself, useful.

## What goes

Most comments (comments have a very high bar for being kept).

Anything that can be gleaned from looking at the code in the same file, including but not limited to:

- **[Common pitfall]** accounts of past changes, fixed bugs, or previous implementations.
- Comments restating the next statement, branch, call, type, or name.
- Narration of straightforward code.
- Section headings.
- Descriptions of standard language or framework behavior.
- Claims of "handle", "process", "ensure", or "set up" with no specific constraint attached.
- Speculation about intent.
- Anything that doesn't pass the `keep-test.md` doc.

## Declaration documentation

`/** ... */` carries a declaration's API or contract, the part useful at a call site. Local implementation rationale stays `//`, including where it sits above a declaration.

## Protected

Byte-identical on the way out: license and copyright notices, generated-code markers, tooling directives (formatter, linter, compiler, coverage, bundler), text consumed by tooling, a reference required for a compatibility workaround, and a TODO or FIXME naming concrete unfinished work. A vague, obsolete, or already-done TODO is not protected.
