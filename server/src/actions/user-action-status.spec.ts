import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { millisecondsInDay } from "date-fns/constants";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { UserAwayRange } from "src/user/entities/user-away-range.entity";
import { User } from "src/user/entities/user.entity";
import { TaskAwayStatus } from "src/utils/action-user";
import { UserActionRelationPillStatus } from "../user/dto/user-action-relations.dto";
import type { ActionEvent } from "./entities/action-event.entity";
import { ActionStatus } from "./entities/action-event.entity";
import {
  computeCanCompleteAction,
  resolveUserActionStatus,
  type UserActionStatus,
  ViewerActionRelation,
  ViewerOptionalReason,
} from "./user-action-status";
import { memberActionPhase } from "./utils/action-event";

/** Fixed "now": 7 days into a 14-day member-action window by default. */
const NOW = new Date("2026-01-08T00:00:00Z");
const PHASE_START = new Date(NOW.getTime() - 7 * millisecondsInDay);
const DEADLINE = new Date(NOW.getTime() + 7 * millisecondsInDay);
const LONG_BEFORE = new Date(PHASE_START.getTime() - 30 * millisecondsInDay);

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
    onboarding: false,
    optional: false,
    preventCompletion: false,
    staffPreview: false,
    archived: false,
    ...overrides,
    events,
    memberActionPhase: memberActionPhase(events),
  };
}

let contractEventSeq = 0;
function contractEvent(date: Date, type: ContractEventType): ContractEvent {
  return Object.assign(new ContractEvent(), {
    id: ++contractEventSeq,
    date,
    type,
  });
}

const signed = (date: Date) => contractEvent(date, ContractEventType.SIGNED);
const suspended = (date: Date) =>
  contractEvent(date, ContractEventType.SUSPENDED);

const AWAY_AROUND_NOW = [
  Object.assign(new UserAwayRange(), {
    startDate: new Date(NOW.getTime() - millisecondsInDay),
    endDate: new Date(NOW.getTime() + millisecondsInDay),
  }),
];

function makeUser(
  overrides: Partial<
    Pick<User, "contractEvents" | "awayRanges" | "staff">
  > = {},
): ResolveParams["user"] {
  return new User({
    contractEvents: [signed(LONG_BEFORE)],
    awayRanges: [],
    staff: false,
    ...overrides,
  });
}

function makeLapsedUser(): ResolveParams["user"] {
  return makeUser({
    contractEvents: [
      signed(LONG_BEFORE),
      suspended(new Date(PHASE_START.getTime() - millisecondsInDay)),
    ],
  });
}

let activitySeq = 0;
function activity(
  type: ActionActivityType,
  overrides: Partial<ResolveParams["activities"][number]> = {},
): ResolveParams["activities"][number] {
  return {
    type,
    createdAt: new Date(
      PHASE_START.getTime() + ++activitySeq * milliseconds({ minutes: 1 }),
    ),
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
      optional: false,
      optionalReason: null,
      canComplete: true,
      relation: ViewerActionRelation.None,
      withdrawal: null,
      dismissed: false,
      away: TaskAwayStatus.NotAway,
      memberActionStarted: true,
      deadlineAt: DEADLINE,
      deadlinePassed: false,
      staffPreview: false,
      display: UserActionRelationPillStatus.Todo,
    });
  });

  it("rejects a reason without optional: true at typecheck", () => {
    const status = resolve();
    // @ts-expect-error a reason needs optional: true
    const _reasonOnly: UserActionStatus = {
      ...status,
      optionalReason: ViewerOptionalReason.ContractGap,
    };
    const _widened: UserActionStatus = {
      ...status,
      optional: true,
      optionalReason: ViewerOptionalReason.ContractGap,
    };
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
    const status = resolve({ user: makeLapsedUser() });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.NotRequired);
  });

  describe("mid-window joiner", () => {
    const joinedMidWindow = () =>
      makeUser({
        contractEvents: [
          signed(new Date(PHASE_START.getTime() + millisecondsInDay)),
        ],
      });

    it("assigns the in-progress action as optional, naming the reason", () => {
      const status = resolve({ user: joinedMidWindow() });
      expect(status.assigned).toBe(true);
      expect(status.optional).toBe(true);
      expect(status.optionalReason).toBe(ViewerOptionalReason.ContractGap);
      expect(status.canComplete).toBe(true);
      expect(status.display).toBe(UserActionRelationPillStatus.OptionalTask);
    });

    it("leaves them optional rather than missing the deadline once it passes", () => {
      const status = resolve({
        user: joinedMidWindow(),
        now: new Date(DEADLINE.getTime() + millisecondsInDay),
      });
      expect(status.deadlinePassed).toBe(true);
      expect(status.display).toBe(UserActionRelationPillStatus.OptionalTask);
    });

    it("does not reach an action that closed before they signed", () => {
      const status = resolve({
        user: makeUser({
          contractEvents: [
            signed(new Date(DEADLINE.getTime() + millisecondsInDay)),
          ],
        }),
      });
      expect(status.assigned).toBe(false);
      expect(status.optional).toBe(false);
      expect(status.optionalReason).toBeNull();
    });

    it("reports no reason on an action that is optional for everyone", () => {
      const status = resolve({
        action: makeAction({ optional: true }),
        user: joinedMidWindow(),
      });
      expect(status.optional).toBe(true);
      expect(status.optionalReason).toBeNull();
    });
  });

  it("blocks both assignment and completion when an onboarding action predates the first contract", () => {
    const status = resolve({ action: makeAction({ onboarding: true }) });
    expect(status.assigned).toBe(false);
    expect(status.canComplete).toBe(false);
  });

  it("assigns onboarding actions to brand-new signups with no contract yet", () => {
    const status = resolve({
      action: makeAction({ onboarding: true }),
      user: makeUser({ contractEvents: [] }),
    });
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
      user: makeUser({ awayRanges: AWAY_AROUND_NOW }),
    });
    expect(status.away).toBe(TaskAwayStatus.AwayCurrently);
    expect(status.assigned).toBe(true);
    expect(status.display).toBe(UserActionRelationPillStatus.Away);
  });

  it("shows completed over away (completions count regardless of absence)", () => {
    const status = resolve({
      user: makeUser({ awayRanges: AWAY_AROUND_NOW }),
      activities: [activity(ActionActivityType.USER_COMPLETED)],
    });
    expect(status.display).toBe(UserActionRelationPillStatus.Completed);
  });

  it("flags a passed deadline", () => {
    const pastDeadline = new Date(NOW.getTime() - millisecondsInDay);
    const status = resolve({
      action: makeAction({
        events: makeEvents({
          start: new Date(NOW.getTime() - 8 * millisecondsInDay),
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
          start: new Date(NOW.getTime() - 8 * millisecondsInDay),
          deadline: new Date(NOW.getTime() - millisecondsInDay),
        }),
      }),
    });
    expect(status.optional).toBe(true);
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
          start: new Date(NOW.getTime() + millisecondsInDay),
          deadline: null,
        }),
      }),
    });
    expect(status.memberActionStarted).toBe(false);
    expect(status.assigned).toBe(true);
    expect(status.canComplete).toBe(true);
  });
});

describe("resolveUserActionStatus staffPreview", () => {
  const upcoming = makeEvents({
    start: new Date(NOW.getTime() + millisecondsInDay),
  });

  it("is set for staff before the member_action event starts", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: upcoming }),
      user: makeUser({ staff: true }),
    });
    expect(status.staffPreview).toBe(true);
  });

  it("is set for staff when no member_action event is scheduled", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: [] }),
      user: makeUser({ staff: true }),
    });
    expect(status.staffPreview).toBe(true);
  });

  it("is unset for non-staff viewers", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true, events: upcoming }),
    });
    expect(status.staffPreview).toBe(false);
  });

  it("is unset once the member_action event starts, with the toggle still on", () => {
    const status = resolve({
      action: makeAction({ staffPreview: true }),
      user: makeUser({ staff: true }),
    });
    expect(status.staffPreview).toBe(false);
  });

  it("is unset for archived actions", () => {
    const status = resolve({
      action: makeAction({
        staffPreview: true,
        archived: true,
        events: upcoming,
      }),
      user: makeUser({ staff: true }),
    });
    expect(status.staffPreview).toBe(false);
  });

  it("is unset with the toggle off", () => {
    const status = resolve({
      action: makeAction({ events: upcoming }),
      user: makeUser({ staff: true }),
    });
    expect(status.staffPreview).toBe(false);
  });
});

describe("computeCanCompleteAction", () => {
  it("does not require a contract for regular actions (decided 2026-07)", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeLapsedUser(),
        inCohort: true,
      }),
    ).toBe(true);
  });

  it("requires cohort membership", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction(),
        user: makeUser(),
        inCohort: false,
      }),
    ).toBe(false);
  });

  it("enforces the onboarding join-timing rule", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ onboarding: true }),
        user: makeUser(),
        inCohort: true,
      }),
    ).toBe(false);
  });

  it("respects preventCompletion", () => {
    expect(
      computeCanCompleteAction({
        action: makeAction({ preventCompletion: true }),
        user: makeUser(),
        inCohort: true,
      }),
    ).toBe(false);
  });
});
