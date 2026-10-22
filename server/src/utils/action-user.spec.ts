import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import { millisecondsInSecond } from "date-fns/constants";
import {
  ActionEvent,
  ActionStatus,
} from "../actions/entities/action-event.entity";
import { UserAwayRange } from "../user/entities/user-away-range.entity";
import type { User } from "../user/entities/user.entity";
import {
  ActionAssignment,
  computeActionAssignment,
  computeContractSignedAfterOnboardingStart,
  computeIsRequiredForAction,
  computeMemberActionAwayStatus,
  computeMissedActionDeadline,
  hasMemberActionDeadlinePassed,
  TaskAwayStatus,
} from "./action-user";

type Params = Parameters<typeof computeActionAssignment>[0];

const PHASE_START = new Date("2020-01-01");
const DEADLINE = new Date("2020-02-01");
const NOW = new Date("2020-01-15");

type ContractUser = Pick<
  User,
  "contractEvents" | "hasActiveContractInFullRange" | "hasActiveContractAt"
>;

function userWithContractSignedAt(date: Date | null): ContractUser {
  return {
    contractEvents: date ? [{ date }] : [],
    hasActiveContractInFullRange: () => false,
    hasActiveContractAt: () => false,
  } as unknown as ContractUser;
}

function makeAction(
  opts: {
    hasMemberActionEvent?: boolean;
    onboarding?: boolean;
    openEnded?: boolean;
  } = {},
): Params["action"] {
  const {
    hasMemberActionEvent = true,
    onboarding = false,
    openEnded = false,
  } = opts;
  return {
    events: hasMemberActionEvent
      ? [{ newStatus: ActionStatus.MemberAction, date: PHASE_START }]
      : [
          {
            newStatus: ActionStatus.OfficeAction,
            date: PHASE_START,
          },
        ],
    onboarding,
    // Mirrors the Action.memberActionPhase getter, which derives the phase
    // from `events`: no member-action event means an empty phase.
    memberActionPhase: hasMemberActionEvent
      ? {
          event: { date: PHASE_START },
          deadlineEvent: openEnded ? null : { date: DEADLINE },
        }
      : { event: null, deadlineEvent: null },
  } as unknown as Params["action"];
}

function makeUser(hasActiveContract: boolean): Params["user"] {
  return {
    contractEvents: [],
    hasActiveContractInFullRange: () => hasActiveContract,
    hasActiveContractAt: () => hasActiveContract,
  } as unknown as Params["user"];
}

function makeMidWindowJoiner(atWindowEnd = true): Params["user"] {
  return {
    contractEvents: [],
    hasActiveContractInFullRange: () => false,
    hasActiveContractAt: () => atWindowEnd,
  } as unknown as Params["user"];
}

function input(overrides: Partial<Params> = {}): Params {
  return {
    action: makeAction(),
    user: makeUser(true),
    inCohort: true,
    dismissed: false,
    now: NOW,
    ...overrides,
  };
}

describe("computeActionAssignment", () => {
  it("is required when in cohort, with a contract active over the member action", () => {
    expect(computeActionAssignment(input())).toBe(ActionAssignment.Required);
  });

  it("is unassigned for a logged-out viewer", () => {
    expect(computeActionAssignment(input({ user: null }))).toBe(
      ActionAssignment.Unassigned,
    );
  });

  it("is unassigned when the action has no member-action event", () => {
    expect(
      computeActionAssignment(
        input({ action: makeAction({ hasMemberActionEvent: false }) }),
      ),
    ).toBe(ActionAssignment.Unassigned);
  });

  it("is unassigned when the user has dismissed the action", () => {
    expect(computeActionAssignment(input({ dismissed: true }))).toBe(
      ActionAssignment.Unassigned,
    );
  });

  it("is unassigned when the user is not in the cohort", () => {
    expect(computeActionAssignment(input({ inCohort: false }))).toBe(
      ActionAssignment.Unassigned,
    );
  });

  describe("contract requirement", () => {
    it("is unassigned without any active contract", () => {
      expect(computeActionAssignment(input({ user: makeUser(false) }))).toBe(
        ActionAssignment.Unassigned,
      );
    });

    it("is required without an active contract for an onboarding action", () => {
      expect(
        computeActionAssignment(
          input({
            action: makeAction({ onboarding: true }),
            user: makeUser(false),
          }),
        ),
      ).toBe(ActionAssignment.Required);
    });
  });

  describe("mid-window joiner", () => {
    it("is optional when the contract covers the deadline but not the window", () => {
      expect(
        computeActionAssignment(input({ user: makeMidWindowJoiner() })),
      ).toBe(ActionAssignment.Optional);
    });

    it("is unassigned when the contract does not reach the deadline", () => {
      expect(
        computeActionAssignment(input({ user: makeMidWindowJoiner(false) })),
      ).toBe(ActionAssignment.Unassigned);
    });

    it("anchors an open-ended window on now", () => {
      const atCalls: Date[] = [];
      const user = {
        contractEvents: [],
        hasActiveContractInFullRange: () => false,
        hasActiveContractAt: (date: Date) => {
          atCalls.push(date);
          return true;
        },
      } as unknown as Params["user"];
      expect(
        computeActionAssignment(
          input({ action: makeAction({ openEnded: true }), user }),
        ),
      ).toBe(ActionAssignment.Optional);
      expect(atCalls).toEqual([NOW]);
    });

    it("anchors a closed window on the deadline, not now", () => {
      const atCalls: Date[] = [];
      const user = {
        contractEvents: [],
        hasActiveContractInFullRange: () => false,
        hasActiveContractAt: (date: Date) => {
          atCalls.push(date);
          return true;
        },
      } as unknown as Params["user"];
      computeActionAssignment(input({ user }));
      expect(atCalls).toEqual([DEADLINE]);
    });

    it("stays unassigned before the phase opens", () => {
      expect(
        computeActionAssignment(
          input({
            user: makeMidWindowJoiner(),
            now: new Date(PHASE_START.getTime() - millisecondsInSecond),
          }),
        ),
      ).toBe(ActionAssignment.Unassigned);
    });

    it("stays unassigned for an onboarding action", () => {
      expect(
        computeActionAssignment(
          input({
            action: makeAction({ onboarding: true }),
            user: userWithContractSignedAt(
              new Date(PHASE_START.getTime() - millisecondsInSecond),
            ),
          }),
        ),
      ).toBe(ActionAssignment.Unassigned);
    });
  });

  describe("onboarding join timing", () => {
    // Excluded even when in the cohort: onboarding targets new members only.
    it("excludes an existing member who joined before the phase began", () => {
      expect(
        computeActionAssignment(
          input({
            action: makeAction({ onboarding: true }),
            user: userWithContractSignedAt(
              new Date(PHASE_START.getTime() - millisecondsInSecond),
            ),
          }),
        ),
      ).toBe(ActionAssignment.Unassigned);
    });

    it("includes a new member who joined at/after the phase began", () => {
      expect(
        computeActionAssignment(
          input({
            action: makeAction({ onboarding: true }),
            user: userWithContractSignedAt(
              new Date(PHASE_START.getTime() + millisecondsInSecond),
            ),
          }),
        ),
      ).toBe(ActionAssignment.Required);
    });
  });
});

describe("computeIsRequiredForAction", () => {
  it("is true when the contract covers the whole window", () => {
    expect(computeIsRequiredForAction(input())).toBe(true);
  });

  it("is false for a mid-window joiner", () => {
    expect(
      computeIsRequiredForAction(input({ user: makeMidWindowJoiner() })),
    ).toBe(false);
  });
});

describe("computeContractSignedAfterOnboardingStart", () => {
  it("treats a user with no contract events as in time", () => {
    expect(
      computeContractSignedAfterOnboardingStart({
        user: userWithContractSignedAt(null),
        memberActionPhaseStart: PHASE_START,
      }),
    ).toBe(true);
  });

  it("is out of time when joined before the phase began", () => {
    expect(
      computeContractSignedAfterOnboardingStart({
        user: userWithContractSignedAt(
          new Date(PHASE_START.getTime() - millisecondsInSecond),
        ),
        memberActionPhaseStart: PHASE_START,
      }),
    ).toBe(false);
  });

  it("is in time when joined exactly at the phase start", () => {
    expect(
      computeContractSignedAfterOnboardingStart({
        user: userWithContractSignedAt(PHASE_START),
        memberActionPhaseStart: PHASE_START,
      }),
    ).toBe(true);
  });

  it("is out of time when a contract holder has no member-action phase start", () => {
    expect(
      computeContractSignedAfterOnboardingStart({
        user: userWithContractSignedAt(PHASE_START),
        memberActionPhaseStart: null,
      }),
    ).toBe(false);
  });
});

describe("hasMemberActionStarted", () => {
  const events = [{ newStatus: ActionStatus.MemberAction, date: PHASE_START }];

  it("is false before the member-action event", () => {
    expect(
      hasMemberActionStarted(
        events,
        new Date(PHASE_START.getTime() - millisecondsInSecond),
      ),
    ).toBe(false);
  });

  it("is true at the instant of the member-action event", () => {
    expect(hasMemberActionStarted(events, PHASE_START)).toBe(true);
  });
});

describe("computeMemberActionAwayStatus", () => {
  it("measures the window from the member-action event, not an earlier event", () => {
    const events = [
      { newStatus: ActionStatus.Planned, date: new Date("2019-12-01") },
      { newStatus: ActionStatus.MemberAction, date: PHASE_START },
      { newStatus: ActionStatus.Resolution, date: DEADLINE },
    ].map((event) => Object.assign(new ActionEvent(), event));
    const awayRange = Object.assign(new UserAwayRange(), {
      startDate: new Date("2019-12-05"),
      endDate: new Date("2019-12-10"),
    });
    expect(
      computeMemberActionAwayStatus({
        action: { events },
        user: { awayRanges: [awayRange] },
        now: NOW,
      }),
    ).toBe(TaskAwayStatus.NotAway);
  });
});

describe("hasMemberActionDeadlinePassed", () => {
  it("is false before the deadline", () => {
    expect(
      hasMemberActionDeadlinePassed(
        DEADLINE,
        new Date(DEADLINE.getTime() - millisecondsInSecond),
      ),
    ).toBe(false);
  });

  it("is true at the deadline instant", () => {
    expect(hasMemberActionDeadlinePassed(DEADLINE, DEADLINE)).toBe(true);
  });

  it("is false for an open-ended phase", () => {
    expect(hasMemberActionDeadlinePassed(null, NOW)).toBe(false);
  });
});

describe("computeMissedActionDeadline", () => {
  type MissedParams = Parameters<typeof computeMissedActionDeadline>[0];
  const AFTER_DEADLINE = new Date(DEADLINE.getTime() + millisecondsInSecond);

  function missedUser(
    opts: {
      fullRangeContract?: boolean;
      atDeadline?: boolean;
      away?: boolean;
    } = {},
  ): MissedParams["user"] {
    const { fullRangeContract = true, atDeadline = true, away = false } = opts;
    return {
      contractEvents: [],
      hasActiveContractInFullRange: () => fullRangeContract,
      hasActiveContractAt: () => atDeadline,
      awayRanges: [],
      isAwayAtAnyPointInRange: () => away,
    };
  }

  function missed(
    overrides: Partial<MissedParams> & {
      optional?: boolean;
      openEnded?: boolean;
    } = {},
  ): boolean {
    const { optional = false, openEnded = false, ...rest } = overrides;
    return computeMissedActionDeadline({
      action: { ...makeAction({ openEnded }), optional },
      user: missedUser(),
      inCohort: true,
      hasTerminalActivity: false,
      now: AFTER_DEADLINE,
      ...rest,
    });
  }

  it("includes a required, present member without a terminal activity", () => {
    expect(missed()).toBe(true);
  });

  it("includes the member at the deadline instant", () => {
    expect(missed({ now: DEADLINE })).toBe(true);
  });

  it("excludes before the deadline", () => {
    expect(missed({ now: NOW })).toBe(false);
  });

  it("excludes an open-ended phase", () => {
    expect(missed({ openEnded: true })).toBe(false);
  });

  it("excludes everyone from an optional action", () => {
    expect(missed({ optional: true })).toBe(false);
  });

  it("excludes a member who completed or withdrew", () => {
    expect(missed({ hasTerminalActivity: true })).toBe(false);
  });

  it("excludes a member outside the cohort", () => {
    expect(missed({ inCohort: false })).toBe(false);
  });

  it("excludes a mid-window signer, who is optional", () => {
    expect(
      missed({
        user: missedUser({ fullRangeContract: false, atDeadline: true }),
      }),
    ).toBe(false);
  });

  it("excludes a member away during the window", () => {
    expect(missed({ user: missedUser({ away: true }) })).toBe(false);
  });
});
