Review comments affected by the supplied diff.

## Scope

Only comments the diff added or modified, plus existing comments the changed code has made false or misleading. Leave unrelated comments elsewhere in the file alone.

Change no executable code, names, types, formatting, or behavior. Add no new comment except to replace an existing useful but defective one.

## Objective

Remove comments that add no important information beyond the nearby code. Treat a newly added comment as unproven — keep it only if it passes the keep test. Harmless or potentially useful is not a reason to keep.

## Keep test

Keep only when all of these hold:

1. It states a concrete fact not quickly apparent from names, types, control flow, and nearby code.
2. That fact matters to correctness, maintenance, security, performance, compatibility, or use of the API.
3. Removing it would plausibly cause a misunderstanding or a wrong future change.
4. It is accurate for the current code.
5. The code already present cannot express it more clearly.

Comments that usually pass explain an invariant or required relationship, a non-obvious rationale or tradeoff, an external constraint or dependency, surprising behavior or an important edge case, a security/correctness/compatibility/performance consequence, a public API contract names and types don't capture, or why an apparently simpler implementation would be wrong.

Never invent a rationale or risk the code and context don't support.

## Delete

Anything that fails the keep test, in particular comments that restate the next statement, branch, call, type, or name; narrate straightforward code; serve as section headings; describe standard language or framework behavior; explain past changes, fixed bugs, or previous implementations; claim "handle", "process", "ensure", "set up" without a specific constraint; or speculate about intent the current code doesn't establish.

```ts
// Check whether the user exists
if (!user) {
```

Accurate description of what the code does is not, by itself, useful.

## Rewrite

Rewrite instead of deleting only when the comment holds important information but is stale, misleading, ambiguous, or much longer than necessary. Preserve the fact; use concise, natural wording. Don't shave words where it makes the comment read worse or needs a second pass to parse.

Recast a historical explanation as the present constraint, when the constraint still matters:

```ts
// We used to sort this differently, but it caused duplicate notifications.
// →
// Keep oldest-first ordering so retries cannot skip an earlier notification.
```

If the current code already makes that constraint clear, delete instead.

## Declaration documentation

`/** ... */` only for documentation that is genuinely part of a declaration's API or contract and useful at call sites. Never convert `//` to JSDoc merely because it sits above a declaration. Local implementation rationale inside a function stays `//`.

## Protected

Never alter license or copyright notices, generated-code markers, tooling directives (formatter, linter, compiler, coverage, bundler), comments whose exact text is consumed by tooling, references required for a compatibility workaround, or a TODO/FIXME naming concrete unfinished work. A vague, obsolete, or already-done TODO is not protected.

## Stability

A comment that passes the keep test is finished. Don't shorten, rephrase, reformat, relocate, or convert it because another valid version exists, and don't tighten comments further on a repeat run.

## Completion

Apply the edits directly. Then verify every remaining in-scope comment passes the keep test and stop. Making no changes is a valid and expected outcome.
