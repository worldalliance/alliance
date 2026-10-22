import { rowKey } from "@alliance/common/forms/row-list";
import type { Row, RowList } from "@alliance/common/forms/row-list-schema";

/** Unsubmitted assignments older than this stop holding their row's place. */
export const STALE_ASSIGNMENT_DAYS = 7;

/**
 * The row with the fewest counted holders, a random one among ties, so members
 * arriving together spread out instead of all taking the first gap.
 */
export function pickBalancedRow(params: {
  list: RowList;
  holdersByKey: ReadonlyMap<string, number>;
  random: () => number;
}): { key: string; values: Row } {
  const { list, holdersByKey, random } = params;
  const keyed = list.rows.map((values) => ({
    key: rowKey(values, list.keyFields),
    values,
  }));
  const holders = (key: string) => holdersByKey.get(key) ?? 0;
  const fewest = Math.min(...keyed.map(({ key }) => holders(key)));
  const candidates = keyed.filter(({ key }) => holders(key) === fewest);
  const picked = candidates[Math.floor(random() * candidates.length)];
  if (picked === undefined)
    throw new Error("No row to assign from an empty list");
  return picked;
}
