import { ActionActivityType } from '@alliance/common/actionActivity';
import { TaskAwayStatus } from 'src/utils/action-user';
import { UserActionRelationPillStatus } from '../user/dto/user-action-relations.dto';
import type { ActionEvent } from './entities/action-event.entity';
import { ActionStatus } from './entities/action-event.entity';
import {
  computeCanCompleteAction,
  resolveUserActionStatus,
  ViewerActionRelation,
} from './user-action-status';
import { memberActionPhase } from './utils/action-event';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fixed "now": 7 days into a 14-day member-action window by default. */
const NOW = new Date('2026-01-08T00:00:00Z');
const PHASE_START = new Date(NOW.getTime() - 7 * DAY_MS);
const DEADLINE = new Date(NOW.getTime() + 7 * DAY_MS);

type ResolveParams = Parameters<typeof resolveUserActionStatus>[0];

function makeEvents(params?: {
  start?: Date;
  deadline?: Date | null;
}): ActionEvent[] {
  const { start = PHASE_START, deadline = DEADLINE } = params ?? {};
  const events = [
    { date: start, newStatus: ActionStatus.MemberAction },
    ...(deadline
      ? [{ date: deadline, newStatus: ActionStatus.Resolution }]
      : []),
  ];
  return events as ActionEvent[];
}

function makeAction(
  overrides: Partial<ResolveParams['action']> & { events?: ActionEvent[] } = {},
): ResolveParams['action'] {
  const events = overrides.events ?? makeEvents();
  return {
    onboarding: false,
    optional: false,
    preventCompletion: false,
    ...overrides,
    events,
    memberActionPhase: memberActionPhase(events),
  };
}

function makeUser(
  overrides: Partial<ResolveParams['user']> = {},
): ResolveParams['user'] {
  return {
    contractEvents: [],
    hasActiveContractInFullRange: () => true,
    awayRanges: [],
    isAwayAtAnyPointInRange: () => false,
    ...overrides,
  };
}

let activitySeq = 0;
function activity(
  type: ActionActivityType,
  overrides: Partial<ResolveParams['activities'][number]> = {},
): ResolveParams['activities'][number] {
  return {
    type,
    createdAt: new Date(PHASE_START.getTime() + ++activitySeq * 60_000),
    ...overrides,
  };
}

function resolve(
  overrides: Partial<ResolveParams> = {},
): ReturnType<typeof resolveUserActionStatus> {
  return resolveUserActionStatus({
    action: makeAction(),
    user: makeUser(),
    inCohort: true,
    activities: [],
    now: NOW,
    ...overrides,
  });
}

describe('resolveUserActionStatus', () => {
  it('resolves the plain assigned-todo case', () => {
    const status = resolve();
    expect(status).toEqual({
      assigned: true,
      canComplete: true,
      relation: ViewerActionRelation.None,
      withdrawal: null,
      dismissed: false,
      away: TaskAwayStatus.NotAway,
      deadlineAt: DEADLINE,
      deadlinePassed: false,
      display: UserActionRelationPillStatus.Todo,
    });
  });

  it('is entirely unassigned outside the cohort', () => {
    const status = resolve({ inCohort: false });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(false);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it('keeps a dismissed user assigned and completable (dismissal is an overlay)', () => {
    const status = resolve({
      activities: [activity(ActionActivityType.USER_DISMISSED)],
    });
    expect(status.dismissed).toBe(true);
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
    expect(status.relation).toBe(ViewerActionRelation.None);
    expect(status.display).toBe(UserActionRelationPillStatus.Todo);
  });

  it('lets a lapsed-contract member complete a regular action without being assigned', () => {
    const status = resolve({
      user: makeUser({ hasActiveContractInFullRange: () => false }),
    });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it('blocks both assignment and completion when an onboarding action predates the first contract', () => {
    const status = resolve({
      action: makeAction({ onboarding: true }),
      user: makeUser({
        contractEvents: [
          { date: new Date(PHASE_START.getTime() - 30 * DAY_MS) },
        ] as ResolveParams['user']['contractEvents'],
      }),
    });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(false);
  });

  it('assigns onboarding actions to brand-new signups with no contract yet', () => {
    const status = resolve({ action: makeAction({ onboarding: true }) });
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
  });

  it('preventCompletion blocks completion but not assignment', () => {
    const status = resolve({ action: makeAction({ preventCompletion: true }) });
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(false);
  });

  it('resolves a completion', () => {
    const status = resolve({
      activities: [activity(ActionActivityType.USER_COMPLETED)],
    });
    expect(status.relation).toBe(ViewerActionRelation.Completed);
    expect(status.withdrawal).toBeNull();
    expect(status.display).toBe(UserActionRelationPillStatus.Completed);
  });

  it.each([
    [{ outOfTime: true }, 'out_of_time', null],
    [{ isMoral: true, declineReason: 'conscience' }, 'moral', 'conscience'],
    [{ declineReason: 'busy week' }, 'other', 'busy week'],
  ] as const)('maps withdrawal %o to reason %s', (fields, reason, note) => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_WONT_COMPLETE, { ...fields }),
      ],
    });
    expect(status.relation).toBe(ViewerActionRelation.Withdrawn);
    expect(status.withdrawal).toEqual({ reason, note });
    expect(status.display).toBe(UserActionRelationPillStatus.WontComplete);
  });

  it('lets the latest terminal activity win', () => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_WONT_COMPLETE, { outOfTime: true }),
        activity(ActionActivityType.USER_COMPLETED),
      ],
    });
    expect(status.relation).toBe(ViewerActionRelation.Completed);
    expect(status.withdrawal).toBeNull();
  });

  it('keeps the dismissed overlay visible after a completion', () => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_DISMISSED),
        activity(ActionActivityType.USER_COMPLETED),
      ],
    });
    expect(status.dismissed).toBe(true);
    expect(status.relation).toBe(ViewerActionRelation.Completed);
  });

  it('shows away for an in-cohort user away during the window', () => {
    const status = resolve({
      user: makeUser({
        awayRanges: [
          {
            startDate: new Date(NOW.getTime() - DAY_MS),
            endDate: new Date(NOW.getTime() + DAY_MS),
          },
        ] as ResolveParams['user']['awayRanges'],
        isAwayAtAnyPointInRange: () => true,
      }),
    });
    expect(status.away).toBe(TaskAwayStatus.AwayCurrently);
    expect(status.assigned).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.Away);
  });

  it('shows completed over away (completions count regardless of absence)', () => {
    const status = resolve({
      user: makeUser({ isAwayAtAnyPointInRange: () => true }),
      activities: [activity(ActionActivityType.USER_COMPLETED)],
    });
    expect(status.display).toBe(UserActionRelationPillStatus.Completed);
  });

  it('flags a passed deadline', () => {
    const pastDeadline = new Date(NOW.getTime() - DAY_MS);
    const status = resolve({
      action: makeAction({
        events: makeEvents({
          start: new Date(NOW.getTime() - 8 * DAY_MS),
          deadline: pastDeadline,
        }),
      }),
    });
    expect(status.deadlineAt).toEqual(pastDeadline);
    expect(status.deadlinePassed).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.MissedDeadline);
  });

  it('shows optional_task for optional actions even past the deadline', () => {
    const status = resolve({
      action: makeAction({
        optional: true,
        events: makeEvents({
          start: new Date(NOW.getTime() - 8 * DAY_MS),
          deadline: new Date(NOW.getTime() - DAY_MS),
        }),
      }),
    });
    expect(status.display).toBe(UserActionRelationPillStatus.OptionalTask);
  });

  it('resolves an action with no member-action phase as not required', () => {
    const status = resolve({
      action: makeAction({ events: [] as ActionEvent[] }),
    });
    expect(status.assigned).toBe(false);
    // The completion rule has no phase gate (matching isCompletionAllowed,
    // which the complete mutation enforces).
    expect(status.canComplete).toBe(true);
    expect(status.deadlineAt).toBeNull();
    expect(status.deadlinePassed).toBe(false);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });
});

describe('computeCanCompleteAction', () => {
  it('does not require a contract for regular actions (decided 2026-07)', () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeUser({ hasActiveContractInFullRange: () => false }),
        inCohort: true,
      }),
    ).toBe(true);
  });

  it('requires cohort membership', () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeUser(),
        inCohort: false,
      }),
    ).toBe(false);
  });

  it('enforces the onboarding join-timing rule', () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ onboarding: true }),
        user: makeUser({
          contractEvents: [
            { date: new Date(PHASE_START.getTime() - 30 * DAY_MS) },
          ] as ResolveParams['user']['contractEvents'],
        }),
        inCohort: true,
      }),
    ).toBe(false);
  });

  it('respects preventCompletion', () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ preventCompletion: true }),
        user: makeUser(),
        inCohort: true,
      }),
    ).toBe(false);
  });
});
