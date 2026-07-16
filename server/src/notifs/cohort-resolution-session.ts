import type { User } from 'src/user/entities/user.entity';

/** Raw slice of a form response needed to evaluate FormFieldValue leaves. */
export type FormResponseAnswerRow = {
  userId: number | null;
  answers: Record<string, unknown> | null;
};

/**
 * Per-batch memo for cohort resolution. All expressions resolved against the
 * same session share one active-user load and one query per distinct leaf
 * (tag, action, form), so resolving a batch of N overlapping expressions
 * costs roughly one expression's worth of queries instead of N.
 *
 * Scope one session to a single request/batch: it never invalidates, so a
 * longer-lived session would serve stale membership.
 *
 * The action-roster and expression memos are keyed by the chain of
 * action-referencing leaf ids (InProgressAction, MissedActionDeadline)
 * currently being resolved (see
 * `ActionEventRecipientService.resolveCohortMemberIds`), so a cyclic
 * expression terminates instead of deadlocking on its own pending promise.
 */
export class CohortResolutionSession {
  activeUsers?: Promise<User[]>;
  candidateUserIds?: Promise<Set<number>>;
  groupLeadUserIds?: Promise<Set<number>>;
  readonly expressionMemberIds = new Map<string, Promise<Set<number>>>();
  readonly tagUserIds = new Map<string, Promise<Set<number>>>();
  readonly completedActionUserIds = new Map<number, Promise<Set<number>>>();
  readonly inProgressActionUserIds = new Map<string, Promise<Set<number>>>();
  readonly missedActionDeadlineUserIds = new Map<
    string,
    Promise<Set<number>>
  >();
  readonly formResponsesByFormId = new Map<
    number,
    Promise<FormResponseAnswerRow[]>
  >();
}
