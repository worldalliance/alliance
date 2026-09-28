import { millisecondsInDay, millisecondsInMinute } from "date-fns/constants";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import {
  isSettled,
  openEnrollments,
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
