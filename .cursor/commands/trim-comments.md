Review comments affected by the supplied diff.

## Scope

Review only:

1. Comments added or modified by the diff.
2. Existing comments that the changed code has made false or misleading.

Do not clean up unrelated comments elsewhere in the file.

Do not change executable code, names, types, formatting, or behavior. Do not add new comments except when replacing an existing useful but defective comment.

## Objective

Remove comments that do not provide important information beyond the nearby code.

Treat newly added comments as unproven. Keep one only when it passes the keep test below. Do not preserve comments merely because they are harmless or potentially useful.

## Keep test

Keep a comment only when all of these are true:

1. It communicates a concrete fact that is not quickly apparent from names, types, control flow, and nearby code.
2. The fact is important to correctness, maintenance, security, performance, compatibility, or use of the API.
3. Removing it would create a plausible risk of misunderstanding or an incorrect future change.
4. It is accurate for the current code.
5. The information cannot be expressed more clearly by the code already present.

Useful comments commonly explain:

- an invariant or required relationship
- a non-obvious rationale or tradeoff
- an external constraint or dependency
- surprising behavior or an important edge case
- a security, correctness, compatibility, or performance consequence
- a public API contract not captured by names and types
- why an apparently simpler implementation would be wrong

Do not invent a rationale or risk that is unsupported by the code or surrounding context.

## Delete

Delete comments that:

- restate the following statement, branch, call, type, or variable name
- narrate steps in straightforward code
- act as unnecessary section headings
- repeat information already expressed by names or types
- describe standard language or framework behavior
- explain past changes, fixed bugs, or previous implementations
- contain vague claims such as “handle,” “process,” “ensure,” or “set up” without adding a specific constraint
- describe implementation details that are immediately visible
- merely make the code look organized or documented
- speculate about intent not established by the current code

Examples of comments to delete:

```ts
// Check whether the user exists
if (!user) {
```

```ts
// Sort by creation date
items.sort((a, b) => a.createdAt - b.createdAt);
```

```ts
// Update the status
record.status = status;
```

A description of what the code does is not useful merely because it is accurate.

## Rewrite

Rewrite instead of deleting only when the comment contains important information but is stale, misleading, ambiguous, or substantially longer than necessary.

Preserve the useful fact. Use concise, natural wording. Do not optimize individual words or remove words when doing so makes the comment less natural or requires a second reading.

Rewrite historical explanations as present constraints when the constraint still matters.

Example:

```ts
// We used to sort this differently, but it caused duplicate notifications.
```

becomes:

```ts
// Keep oldest-first ordering so retries cannot skip an earlier notification.
```

If the current code already makes the constraint clear, delete the comment instead.

## Declaration documentation

Use `/** ... */` only for documentation that is genuinely part of a declaration’s API or contract and useful at call sites.

Do not convert a `//` comment to JSDoc solely because it appears above a declaration.

Use `//` for local implementation rationale inside a function.

## Protected comments

Do not alter:

- license or copyright notices
- generated-code markers
- formatter, linter, compiler, coverage, or bundler directives
- comments whose exact text is consumed by tooling
- TODOs or FIXMEs that identify concrete unfinished work
- references required for compatibility workarounds

A TODO is not protected when it is vague, obsolete, or describes work already completed.

## Stability rule

A comment that passes the keep test is finished.

Do not shorten, rephrase, reformat, relocate, or convert a passing comment merely because another valid version is possible. Make no stylistic changes to passing comments.

Do not progressively tighten comments across repeated runs.

## Completion

Apply the edits directly.

After editing, verify that every remaining in-scope comment passes the keep test. If they all pass, stop and make no further changes.

It is valid and expected to make no changes when all in-scope comments already pass.
