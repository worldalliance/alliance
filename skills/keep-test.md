# Keep test

Test for whether to keep text (unit).

## The test

Keep a unit only when all of these hold:

1. It states a concrete fact its source of truth does not already carry.
2. That fact changes what someone reading it does next.
3. It is accurate for the current code and the current world.
4. Nothing already present expresses it more clearly.

Test the unit by deleting it and naming what a reader now does differently. Name a divergent action and the unit earns its place. Name none and it stays deleted. Harmless, or useful one day, is not a reason to keep. A unit the change under review added starts unproven and earns its place like any other.

## Whole units

A unit that fails goes in full. Shaving words off it degrades every sentence at once and buys back little, where cutting whole units leaves what survives fully legible.

## Rewrite

Rewrite only to save a fact that passes the test but arrives stale, misleading, ambiguous, or far longer than it needs to be. Preserve the fact in concise, natural wording. Rewriting is not a softer delete: a unit that fails the test has no fact to save.

Never invent a rationale, risk, or constraint the surroundings do not support.

## Present tense

State the constraint that holds now, not the history that produced it.

```ts
// We used to sort this differently, but it caused duplicate notifications.
// →
// Keep oldest-first ordering so retries cannot skip an earlier notification.
```

If what's already there makes the constraint clear, delete instead. Change history, migration notes, and reorg rationale describe the past; the reader acts on the present.

## Corrections replace

A correction removes lines as well as adding them. Rewrite the line that produced the wrong behavior, in place. Leaving the old version standing beside its replacement keeps the old one available and costs load on every future read.

The finished text reads as if the wrong version never existed. Someone who never saw the correction cannot tell what changed.

## Scope

The pass covers what the change touched, plus what the change made false or misleading. Leave everything else as found, including units elsewhere in the same file that would fail the test.

## Protected

Each pass names its own protected material. A protected unit comes back byte-identical, whatever the test says about it.

## Stability

A unit that survives is finished. Its wording, format, and location stay as they are, on this run and on every repeat run. On text that already passes, making no changes is the expected outcome.
