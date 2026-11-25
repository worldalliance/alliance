import { forCount } from "@alliance/common/plural";

/** A count or amount as staff read it: 2,911. Not for the number inside a typed phrase. */
export const formatCount = (value: number): string =>
  value.toLocaleString("en-US");

/** A count with its noun: `countOf(2911, "member")` is "2,911 members". */
export const countOf = (count: number, noun: string): string =>
  `${formatCount(count)} ${forCount(count, noun)}`;
