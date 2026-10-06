import { millisecondsInDay, millisecondsInMinute } from "date-fns/constants";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import {
  closedEnrollmentsInCatchUp,
  decisionReadActionIds,
  findReadClosedEnrollments,
  isSettled,
  openEnrollments,
  orderByDecisionReads,
  readsDecisionsOf,
  readsSavedDecisions,
} from "./cohort-decision";
import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import { memberActionPhase } from "./utils/action-event";

const NOW = new Date("2026-01-08T00:00:00Z");
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * millisecondsInDay);

function makeAction(params: {
  start?: Date | null;
  deadline?: Date | null;
  onboarding?: boolean;
  publicOnly?: boolean;
}) {
  const {
    start = daysFromNow(-1),
    deadline = daysFromNow(3),
    onboarding = false,
    publicOnly = false,
  } = params;
  const events = [
    ...(start ? [{ date: start, newStatus: ActionStatus.MemberAction }] : []),
    ...(deadline
      ? [{ date: deadline, newStatus: ActionStatus.Resolution }]
      : []),
  ].map((event) => Object.assign(new ActionEvent(), event));
  return {
    events,
    onboarding,
    publicOnly,
    memberActionPhase: memberActionPhase(events),
  };
}

describe("readsSavedDecisions", () => {
  it("reads saved decisions for an open action", () => {
    expect(readsSavedDecisions(makeAction({}), NOW)).toBe(true);
  });

  it("reads saved decisions for a closed action", () => {
    const action = makeAction({
      start: daysFromNow(-10),
      deadline: daysFromNow(-3),
    });

    expect(readsSavedDecisions(action, NOW)).toBe(true);
  });

  it("reads the live cohort before launch", () => {
    expect(
      readsSavedDecisions(makeAction({ start: daysFromNow(1) }), NOW),
    ).toBe(false);
  });

  it("reads the live cohort without a member-action event", () => {
    expect(readsSavedDecisions(makeAction({ start: null }), NOW)).toBe(false);
  });

  it("reads the live cohort for a public-only action", () => {
    expect(readsSavedDecisions(makeAction({ publicOnly: true }), NOW)).toBe(
      false,
    );
  });
});

describe("openEnrollments", () => {
  it("keeps open actions and drops planned and closed ones", () => {
    const open = makeAction({});
    const planned = makeAction({ start: daysFromNow(1) });
    const closed = makeAction({
      start: daysFromNow(-10),
      deadline: daysFromNow(-3),
    });
    const onboarding = makeAction({
      start: daysFromNow(-10),
      deadline: daysFromNow(-3),
      onboarding: true,
    });

    expect(
      openEnrollments([open, planned, closed, onboarding], NOW).map(
        ({ action }) => action,
      ),
    ).toEqual([open, onboarding]);
  });
});

describe("closedEnrollmentsInCatchUp", () => {
  it("keeps closed actions still in catch-up and drops the rest", () => {
    const recent = makeAction({
      start: daysFromNow(-10),
      deadline: daysFromNow(-3),
    });
    const old = makeAction({
      start: daysFromNow(-20),
      deadline: daysFromNow(-8),
    });
    const open = makeAction({});
    const onboarding = makeAction({
      start: daysFromNow(-10),
      deadline: daysFromNow(-3),
      onboarding: true,
    });

    expect(
      closedEnrollmentsInCatchUp({
        actions: [recent, old, open, onboarding],
        now: NOW,
      }).map(({ action }) => action),
    ).toEqual([recent]);
  });
});

describe("decisionReadActionIds", () => {
  it("collects the actions MissedActionDeadline leaves read, and no others", () => {
    expect(
      decisionReadActionIds({
        type: "AND",
        children: [
          { type: "MissedActionDeadline", actionId: 1 },
          { type: "CompletedAction", actionId: 2 },
          {
            type: "NOT",
            child: { type: "MissedActionDeadline", actionId: 3 },
          },
        ],
      }),
    ).toEqual([1, 3]);
  });
});

describe("readsDecisionsOf", () => {
  it("is true only when a MissedActionDeadline leaf reads one of the actions", () => {
    const expr = {
      type: "AND" as const,
      children: [
        { type: "CompletedAction" as const, actionId: 1 },
        { type: "MissedActionDeadline" as const, actionId: 2 },
      ],
    };

    expect(readsDecisionsOf(expr, new Set([2]))).toBe(true);
    expect(readsDecisionsOf(expr, new Set([1]))).toBe(false);
  });
});

describe("orderByDecisionReads", () => {
  const item = (id: number, reads: number[]) => ({
    action: {
      id,
      cohortExpression: {
        type: "OR" as const,
        children: reads.map((actionId) => ({
          type: "MissedActionDeadline" as const,
          actionId,
        })),
      },
    },
  });

  it("puts each action after the ones whose decisions it reads", () => {
    const reader = item(1, [2]);
    const middle = item(2, [3]);
    const read = item(3, []);

    expect(orderByDecisionReads([reader, middle, read])).toEqual([
      read,
      middle,
      reader,
    ]);
  });

  it("keeps every action of a cycle", () => {
    const a = item(1, [2]);
    const b = item(2, [1]);

    expect(orderByDecisionReads([a, b])).toHaveLength(2);
  });

  it("decides a cycle's lowest id last, whatever order it is listed in", () => {
    const a = item(1, [2]);
    const b = item(2, [1]);

    expect(orderByDecisionReads([a, b])).toEqual([b, a]);
    expect(orderByDecisionReads([b, a])).toEqual([b, a]);
  });

  it("breaks a cycle at its lowest id when a lower id outside it reads into it", () => {
    const outside = item(1, [3]);
    const low = item(2, [3]);
    const high = item(3, [2]);

    expect(orderByDecisionReads([outside, low, high])).toEqual([
      high,
      low,
      outside,
    ]);
    expect(orderByDecisionReads([low, high])).toEqual([high, low]);
  });
});

describe("findReadClosedEnrollments", () => {
  const closedAction = (id: number, reads: number[]) => ({
    ...makeAction({ start: daysFromNow(-10), deadline: daysFromNow(-3) }),
    id,
    cohortExpression: {
      type: "OR" as const,
      children: reads.map((actionId) => ({
        type: "MissedActionDeadline" as const,
        actionId,
      })),
    },
  });

  it("follows reads through closed actions", async () => {
    const reader = closedAction(2, [3]);
    const read = closedAction(3, []);
    const byId = new Map([reader, read].map((action) => [action.id, action]));
    const loaded: number[][] = [];

    const closed = await findReadClosedEnrollments({
      actions: [
        { cohortExpression: { type: "MissedActionDeadline", actionId: 2 } },
      ],
      load: async (ids) => {
        loaded.push(ids);
        return ids.flatMap((id) => byId.get(id) ?? []);
      },
      now: NOW,
    });

    expect(closed.map(({ action }) => action)).toEqual([reader, read]);
    expect(loaded).toEqual([[2], [3]]);
  });
});

describe("isSettled", () => {
  const signedMinutesAgo = (minutes: number) => ({
    contractEvents: [
      Object.assign(new ContractEvent(), {
        type: ContractEventType.SIGNED,
        date: new Date(NOW.getTime() - minutes * millisecondsInMinute),
      }),
    ],
  });

  it("waits out a signing inside the grace period", () => {
    expect(isSettled(signedMinutesAgo(9), NOW)).toBe(false);
  });

  it("settles a signing at the end of the grace period", () => {
    expect(isSettled(signedMinutesAgo(10), NOW)).toBe(true);
  });

  it("ignores a recent suspension", () => {
    const user = {
      contractEvents: [
        Object.assign(new ContractEvent(), {
          type: ContractEventType.SUSPENDED,
          date: NOW,
        }),
      ],
    };

    expect(isSettled(user, NOW)).toBe(true);
  });
});
