import {
  KORA_MIN_CONVERSATIONS,
  KORA_PRACTICE_COUNT,
  KoraItemType,
  koraWeightUnits,
} from "@alliance/common/kora";

export type HeldItem = { itemType: KoraItemType; nTurns: number };

export const isRated = (itemType: KoraItemType): boolean =>
  itemType === KoraItemType.Scored || itemType === KoraItemType.Attention;

/** Load units the session has spent: practice counts nothing, everything else by its length. */
export const spentUnits = (held: HeldItem[]): number =>
  held
    .filter((item) => isRated(item.itemType))
    .reduce((sum, item) => sum + koraWeightUnits(item.nTurns), 0);

export const ratedCount = (held: HeldItem[]): number =>
  held.filter((item) => isRated(item.itemType)).length;

/**
 * Whether one more conversation fits: the budget stops the session, except that a session never
 * holds fewer than three conversations, however long they are (spec 6.0 section 7).
 */
export function fits(params: {
  held: HeldItem[];
  nTurns: number;
  budgetUnits: number;
}): boolean {
  if (ratedCount(params.held) < KORA_MIN_CONVERSATIONS) return true;
  return (
    spentUnits(params.held) + koraWeightUnits(params.nTurns) <=
    params.budgetUnits
  );
}

/**
 * The practice conversation to serve next, by import order, or null once both are done.
 * `practiceServed` counts every practice conversation this reviewer has been given, the open
 * session's included, so it is the index of the next one.
 */
export function practiceDue(params: {
  sessionNumber: number;
  practiceServed: number;
}): number | null {
  if (params.sessionNumber !== 1) return null;
  return params.practiceServed < KORA_PRACTICE_COUNT
    ? params.practiceServed
    : null;
}

/**
 * Where the attention conversation sits: position 2 or 3 of the first session, at random but the
 * same answer every time it is asked, so a reload doesn't move it (spec 6.0 section 7).
 */
export function attentionPosition(reviewerId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < reviewerId.length; i++) {
    hash ^= reviewerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return 2 + (hash % 2);
}

/** Whether the next rated conversation should be the reviewer's one attention conversation. */
export function attentionDue(params: {
  sessionNumber: number;
  held: HeldItem[];
  attentionServedBefore: boolean;
  reviewerId: string;
}): boolean {
  if (params.sessionNumber !== 1 || params.attentionServedBefore) return false;
  if (params.held.some((item) => item.itemType === KoraItemType.Attention))
    return false;
  return ratedCount(params.held) + 1 === attentionPosition(params.reviewerId);
}
