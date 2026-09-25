import { millisecondsInSecond } from "date-fns/constants";
import { ActionStatus } from "../actions/entities/action-event.entity";
import type { User } from "../user/entities/user.entity";
import {
  ActionAssignment,
  computeActionAssignment,
  computeContractSignedAfterOnboardingStart,
  computeIsAssignedFromCohortSet,
  computeIsRequiredForAction,
  hasMemberActionDeadlinePassed,
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

describe("computeIsAssignedFromCohortSet", () => {
  type PopulationParams = Parameters<typeof computeIsAssignedFromCohortSet>[0];

  function makePopulationUser(opts: {
    id?: number;
    hasContractInFullRange?: boolean;
    hasContractAtWindowEnd?: boolean;
    contractSignedAt?: Date | null;
  }): {
    user: User;
    fullRangeCalls: { startDate?: Date | null; endDate?: Date | null }[];
  } {
    const {
      id = 1,
      hasContractInFullRange = true,
      hasContractAtWindowEnd = hasContractInFullRange,
      contractSignedAt = null,
    } = opts;
    const fullRangeCalls: { startDate?: Date | null; endDate?: Date | null }[] =
      [];
    const user = {
      id,
      contractEvents: contractSignedAt ? [{ date: contractSignedAt }] : [],
      hasActiveContractInFullRange: (range: {
        startDate?: Date | null;
        endDate?: Date | null;
      }) => {
        fullRangeCalls.push(range);
        return hasContractInFullRange;
      },
      hasActiveContractAt: () => hasContractAtWindowEnd,
    } as unknown as User;
    return { user, fullRangeCalls };
  }

  function populationInput(
    overrides: Partial<PopulationParams> = {},
  ): PopulationParams {
    return {
      eventDate: PHASE_START,
      deadlineDate: DEADLINE,
      cohortMemberIds: new Set([1]),
      user: makePopulationUser({}).user,
      userDismissed: false,
      onboarding: false,
      ...overrides,
    };
  }

  it("participates when in cohort with a contract active over the window", () => {
    expect(computeIsAssignedFromCohortSet(populationInput())).toBe(true);
  });

  it("does not participate when dismissed, unless includeDismissed", () => {
    expect(
      computeIsAssignedFromCohortSet(populationInput({ userDismissed: true })),
    ).toBe(false);
    expect(
      computeIsAssignedFromCohortSet(
        populationInput({ userDismissed: true, includeDismissed: true }),
      ),
    ).toBe(true);
  });

  it("does not participate when not in the cohort", () => {
    expect(
      computeIsAssignedFromCohortSet(
        populationInput({ cohortMemberIds: new Set([999]) }),
      ),
    ).toBe(false);
  });

  it("does not participate without a contract active over the window", () => {
    const { user } = makePopulationUser({ hasContractInFullRange: false });
    expect(computeIsAssignedFromCohortSet(populationInput({ user }))).toBe(
      false,
    );
  });

  it("still requires the full-window contract when the deadline is null", () => {
    // Regression: a null deadline used to skip the full-range check, so
    // lapsed-contract users were included here but excluded by the self-view
    // predicate (computeActionAssignment).
    const { user, fullRangeCalls } = makePopulationUser({
      hasContractInFullRange: false,
    });
    expect(
      computeIsAssignedFromCohortSet(
        populationInput({ user, deadlineDate: null }),
      ),
    ).toBe(false);
    expect(fullRangeCalls).toEqual([{ startDate: PHASE_START, endDate: null }]);
  });

  it("includeSuspended skips the contract-lapse exclusion", () => {
    const { user, fullRangeCalls } = makePopulationUser({
      hasContractInFullRange: false,
    });
    expect(
      computeIsAssignedFromCohortSet(
        populationInput({ user, includeSuspended: true }),
      ),
    ).toBe(true);
    expect(
      computeIsAssignedFromCohortSet(
        populationInput({ user, deadlineDate: null, includeSuspended: true }),
      ),
    ).toBe(true);
    expect(fullRangeCalls).toEqual([]);
  });

  it("excludes a mid-window joiner the self-view predicate calls optional", () => {
    const { user } = makePopulationUser({
      hasContractInFullRange: false,
      hasContractAtWindowEnd: true,
    });
    expect(computeIsAssignedFromCohortSet(populationInput({ user }))).toBe(
      false,
    );
  });

  describe("onboarding join timing", () => {
    it("excludes an existing member who joined before the event", () => {
      const { user } = makePopulationUser({
        contractSignedAt: new Date(
          PHASE_START.getTime() - millisecondsInSecond,
        ),
      });
      expect(
        computeIsAssignedFromCohortSet(
          populationInput({ user, onboarding: true }),
        ),
      ).toBe(false);
    });

    it("includes a new member who joined at/after the event", () => {
      const { user } = makePopulationUser({
        contractSignedAt: new Date(
          PHASE_START.getTime() + millisecondsInSecond,
        ),
      });
      expect(
        computeIsAssignedFromCohortSet(
          populationInput({ user, onboarding: true }),
        ),
      ).toBe(true);
    });
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
