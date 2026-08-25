import pluralize from "pluralize";

/**
 * The form of a noun that goes with `count`, e.g. `forCount(2, "like")` →
 * "likes". The plural is derived by the `pluralize` package, so it is only
 * meaningful for nouns — for a verb, pronoun or demonstrative, or a noun whose
 * plural should not be the derived one, use `pickForCount`.
 */
export const forCount = (count: number, noun: string) =>
  count === 1 ? noun : pluralize.plural(noun);

/**
 * Count-inclusive label, e.g. `withCount(2, "like")` → "2 likes". Same rules as
 * `forCount`.
 */
export const withCount = (count: number, noun: string) =>
  `${count} ${forCount(count, noun)}`;

/**
 * Picks between two written-out forms for anything `pluralize` cannot derive,
 * e.g. `pickForCount(2, "needs", "need")` → "need".
 */
export const pickForCount = (count: number, one: string, other: string) =>
  count === 1 ? one : other;
