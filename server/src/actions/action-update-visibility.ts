import { LessThanOrEqual, type FindOptionsWhere } from 'typeorm';
import type { ActionUpdate } from './entities/action-update.entity';

/**
 * `visibleAt` stays null until the first body save. SQL comparisons exclude
 * null, so this predicate also keeps empty drafts out of member-facing reads.
 */
export function publishedActionUpdateWhere(
  now: Date,
): FindOptionsWhere<ActionUpdate> {
  return { visibleAt: LessThanOrEqual(now) };
}

export function isActionUpdatePublished(
  update: Pick<ActionUpdate, 'visibleAt'>,
  now: Date,
): boolean {
  return update.visibleAt !== null && update.visibleAt <= now;
}
