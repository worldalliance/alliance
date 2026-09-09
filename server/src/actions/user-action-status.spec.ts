import { ActionActivityType } from "@alliance/common/actionActivity";
import { TaskAwayStatus } from "src/utils/action-user";
import { UserActionRelationPillStatus } from "../user/dto/user-action-relations.dto";
import type { ActionEvent } from "./entities/action-event.entity";
import { ActionStatus } from "./entities/action-event.entity";
import {
  computeCanCompleteAction,
  memberActionHasOpened,
  resolveUserActionStatus,
  ViewerActionRelation,
} from "./user-action-status";
import { memberActionPhase } from "./utils/action-event";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fixed "now": 7 days into a 14-day member-action window by default. */
const NOW = new Date("2026-01-08T00:00:00Z");
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
  overrides: Partial<ResolveParams["action"]> & { events?: ActionEvent[] } = {},
): ResolveParams["action"] {
  const events = overrides.events ?? makeEvents();
  return {
    archived: false,
    onboarding: false,
    optional: false,
    preventCompletion: false,
    staffPreview: false,
    ...overrides,
    events,
    memberActionPhase: memberActionPhase(events),
  };
}

function makeUser(
  overrides: Partial<ResolveParams["user"]> = {},
): ResolveParams["user"] {
  return {
    admin: false,
    contractEvents: [],
    hasActiveContractInFullRange: () => true,
    awayRanges: [],
    isAwayAtAnyPointInRange: () => false,
    staff: false,
    ...overrides,
  };
}

let activitySeq = 0;
function activity(
  type: ActionActivityType,
  overrides: Partial<ResolveParams["activities"][number]> = {},
): ResolveParams["activities"][number] {
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

describe("resolveUserActionStatus", () => {
  it("resolves the plain assigned-todo case", () => {
    const status = resolve();
    expect(status).toEqual({
      assigned: true,
      canComplete: true,
      relation: ViewerActionRelation.None,
      withdrawal: null,
      dismissed: false,
      away: TaskAwayStatus.NotAway,
      memberActionStarted: true,
      deadlineAt: DEADLINE,
      deadlinePassed: false,
      display: UserActionRelationPillStatus.Todo,
      preview: false,
      discussionClosed: false,
    });
  });

  it("flags a staff-preview action for staff, describing it as unstarted", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: [] }),
      user: makeUser({ staff: true }),
      inCohort: true,
    });
    expect(status).toEqual({
      assigned: false,
      canComplete: false,
      relation: ViewerActionRelation.None,
      withdrawal: null,
      dismissed: false,
      away: TaskAwayStatus.NotAway,
      memberActionStarted: false,
      deadlineAt: null,
      deadlinePassed: false,
      display: UserActionRelationPillStatus.NotRequired,
      preview: true,
      discussionClosed: true,
    });
  });

  it("flags a preview for an admin who is not staff, as visibility does", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: [] }),
      user: makeUser({ admin: true }),
      inCohort: true,
    });
    expect(status.preview).toBe(true);
    expect(status.canComplete).toBe(false);
  });

  it("withholds the flag from staff on an archived preview, as visibility does", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, archived: true, events: [] }),
      user: makeUser({ staff: true }),
      inCohort: true,
    });
    expect(status.preview).toBe(false);
  });

  it("withholds the flag from an admin on an archived preview too", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, archived: true, events: [] }),
      user: makeUser({ admin: true }),
      inCohort: true,
    });
    expect(status.preview).toBe(false);
  });

  it("leaves a non-staff viewer of a preview action with the completion they had", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: [] }),
    });
    expect(status.preview).toBe(false);
    expect(status.canComplete).toBe(true);
  });

  it("ignores the preview flag once the member action has opened", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true }),
      user: makeUser({ staff: true }),
    });
    expect(status.preview).toBe(false);
    expect(status.canComplete).toBe(true);
    expect(status.deadlineAt).toEqual(DEADLINE);
  });

  it("retires a preview on an action that got past the launch without one", () => {
    const status = resolve({
      action: makeAction({
        staffPreview: true,
        events: [
          {
            date: new Date(NOW.getTime() - DAY_MS),
            newStatus: ActionStatus.Resolution,
          },
        ] as ActionEvent[],
      }),
      user: makeUser({ staff: true }),
    });
    expect(status.preview).toBe(false);
  });

  it("flags a preview while the member action is still ahead", () => {
    const status = resolve({
      action: makeAction({
        staffPreview: true,
        events: [
          {
            date: new Date(NOW.getTime() + DAY_MS),
            newStatus: ActionStatus.MemberAction,
          },
        ] as ActionEvent[],
      }),
      user: makeUser({ staff: true }),
      inCohort: true,
    });
    expect(status.preview).toBe(true);
    expect(status.canComplete).toBe(false);
  });

  it("leaves the discussion open on a preview members can already read", () => {
    const status = resolve({
      action: makeAction({
        staffPreview: true,
        events: [
          {
            date: new Date(NOW.getTime() - DAY_MS),
            newStatus: ActionStatus.OfficeAction,
          },
          {
            date: new Date(NOW.getTime() + DAY_MS),
            newStatus: ActionStatus.MemberAction,
          },
        ] as ActionEvent[],
      }),
      user: makeUser({ staff: true }),
      inCohort: true,
    });
    expect(status.preview).toBe(true);
    expect(status.discussionClosed).toBe(false);
  });

  it("is entirely unassigned outside the cohort", () => {
    const status = resolve({ inCohort: false });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(false);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it("keeps a dismissed user assigned and completable (dismissal is an overlay)", () => {
    const status = resolve({
      activities: [activity(ActionActivityType.USER_DISMISSED)],
    });
    expect(status.dismissed).toBe(true);
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
    expect(status.relation).toBe(ViewerActionRelation.None);
    expect(status.display).toBe(UserActionRelationPillStatus.Todo);
  });

  it("lets a lapsed-contract member complete a regular action without being assigned", () => {
    const status = resolve({
      user: makeUser({ hasActiveContractInFullRange: () => false }),
    });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it("blocks both assignment and completion when an onboarding action predates the first contract", () => {
    const status = resolve({
      action: makeAction({ onboarding: true }),
      user: makeUser({
        contractEvents: [
          { date: new Date(PHASE_START.getTime() - 30 * DAY_MS) },
        ] as ResolveParams["user"]["contractEvents"],
      }),
    });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(false);
  });

  it("assigns onboarding actions to brand-new signups with no contract yet", () => {
    const status = resolve({ action: makeAction({ onboarding: true }) });
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
  });

  it("preventCompletion blocks completion but not assignment", () => {
    const status = resolve({ action: makeAction({ preventCompletion: true }) });
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(false);
  });

  it("resolves a completion", () => {
    const status = resolve({
      activities: [activity(ActionActivityType.USER_COMPLETED)],
    });
    expect(status.relation).toBe(ViewerActionRelation.Completed);
    expect(status.withdrawal).toBeNull();
    expect(status.display).toBe(UserActionRelationPillStatus.Completed);
  });

  it.each([
    [{ outOfTime: true }, "out_of_time", null],
    [{ isMoral: true, declineReason: "conscience" }, "moral", "conscience"],
    [{ declineReason: "busy week" }, "other", "busy week"],
  ] as const)("maps withdrawal %o to reason %s", (fields, reason, note) => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_WONT_COMPLETE, { ...fields }),
      ],
    });
    expect(status.relation).toBe(ViewerActionRelation.Withdrawn);
    expect(status.withdrawal).toEqual({ reason, note });
    expect(status.display).toBe(UserActionRelationPillStatus.WontComplete);
  });

  it("lets the latest terminal activity win", () => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_WONT_COMPLETE, { outOfTime: true }),
        activity(ActionActivityType.USER_COMPLETED),
      ],
    });
    expect(status.relation).toBe(ViewerActionRelation.Completed);
    expect(status.withdrawal).toBeNull();
  });

  it("keeps the dismissed overlay visible after a completion", () => {
    const status = resolve({
      activities: [
        activity(ActionActivityType.USER_DISMISSED),
        activity(ActionActivityType.USER_COMPLETED),
      ],
    });
    expect(status.dismissed).toBe(true);
    expect(status.relation).toBe(ViewerActionRelation.Completed);
  });

  it("shows away for an in-cohort user away during the window", () => {
    const status = resolve({
      user: makeUser({
        awayRanges: [
          {
            startDate: new Date(NOW.getTime() - DAY_MS),
            endDate: new Date(NOW.getTime() + DAY_MS),
          },
        ] as ResolveParams["user"]["awayRanges"],
        isAwayAtAnyPointInRange: () => true,
      }),
    });
    expect(status.away).toBe(TaskAwayStatus.AwayCurrently);
    expect(status.assigned).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.Away);
  });

  it("shows completed over away (completions count regardless of absence)", () => {
    const status = resolve({
      user: makeUser({ isAwayAtAnyPointInRange: () => true }),
      activities: [activity(ActionActivityType.USER_COMPLETED)],
    });
    expect(status.display).toBe(UserActionRelationPillStatus.Completed);
  });

  it("flags a passed deadline", () => {
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

  it("shows optional_task for optional actions even past the deadline", () => {
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

  it("resolves an action with no member-action phase as not required", () => {
    const status = resolve({
      action: makeAction({ events: [] as ActionEvent[] }),
    });
    expect(status.assigned).toBe(false);
    // The completion rule has no phase gate (matching isCompletionAllowed,
    // which the complete mutation enforces).
    expect(status.canComplete).toBe(true);
    expect(status.memberActionStarted).toBe(false);
    expect(status.deadlineAt).toBeNull();
    expect(status.deadlinePassed).toBe(false);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it("marks an upcoming phase as not started while assignment already applies", () => {
    const status = resolve({
      action: makeAction({
        events: makeEvents({
          start: new Date(NOW.getTime() + DAY_MS),
          deadline: null,
        }),
      }),
    });
    expect(status.memberActionStarted).toBe(false);
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
  });
});

describe("computeCanCompleteAction", () => {
  it("does not require a contract for regular actions (decided 2026-07)", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeUser({ hasActiveContractInFullRange: () => false }),
        inCohort: true,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("requires cohort membership", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeUser(),
        inCohort: false,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("enforces the onboarding join-timing rule", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ onboarding: true }),
        user: makeUser({
          contractEvents: [
            { date: new Date(PHASE_START.getTime() - 30 * DAY_MS) },
          ] as ResolveParams["user"]["contractEvents"],
        }),
        inCohort: true,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("respects preventCompletion", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ preventCompletion: true }),
        user: makeUser(),
        inCohort: true,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("refuses a staff-preview action for whoever the preview lets in", () => {
    const canComplete = (user: ResolveParams["user"]) =>
      computeCanCompleteAction({
        action: makeAction({ staffPreview: true, events: [] }),
        user,
        inCohort: true,
        now: NOW,
      });
    expect(canComplete(makeUser({ staff: true }))).toBe(false);
    expect(canComplete(makeUser({ admin: true }))).toBe(false);
    // A member the preview does not cover keeps the completion they had.
    expect(canComplete(makeUser())).toBe(true);
  });

  it("ignores the preview flag once the member action has opened", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ staffPreview: true }),
        user: makeUser({ staff: true }),
        inCohort: true,
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("memberActionHasOpened", () => {
  const event = (offsetDays: number, newStatus: ActionStatus) =>
    ({
      date: new Date(NOW.getTime() + offsetDays * DAY_MS),
      newStatus,
    }) as ActionEvent;

  it("counts a status the launch had to precede, event or no event", () => {
    expect(
      memberActionHasOpened([event(-1, ActionStatus.Resolution)], NOW),
    ).toBe(true);
    expect(
      memberActionHasOpened([event(-1, ActionStatus.Abandoned)], NOW),
    ).toBe(true);
  });

  it("says no on every status the launch is still ahead of", () => {
    expect(memberActionHasOpened([], NOW)).toBe(false);
    expect(memberActionHasOpened([event(-1, ActionStatus.Planned)], NOW)).toBe(
      false,
    );
    expect(
      memberActionHasOpened(
        [
          event(-1, ActionStatus.OfficeAction),
          event(1, ActionStatus.MemberAction),
        ],
        NOW,
      ),
    ).toBe(false);
  });

  it("stays spent once the event is past, whatever the status reads now", () => {
    expect(
      memberActionHasOpened(
        [event(-2, ActionStatus.MemberAction), event(-1, ActionStatus.Planned)],
        NOW,
      ),
    ).toBe(true);
  });
});
