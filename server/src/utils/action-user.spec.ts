import { ActionStatus } from "../actions/entities/action-event.entity";
import type { User } from "../user/entities/user.entity";
import {
  computeContractSignedAfterOnboardingStart,
  computeIsAssignedFromCohortSet,
  computeIsAssignedToAction,
} from "./action-user";

type Params = Parameters<typeof computeIsAssignedToAction>[0];

const PHASE_START = new Date("2020-01-01");

function userWithContractSignedAt(
  date: Date | null,
): Pick<User, "contractEvents" | "hasActiveContractInFullRange"> {
  return {
    contractEvents: date ? [{ date }] : [],
    hasActiveContractInFullRange: () => false,
  } as unknown as Pick<User, "contractEvents" | "hasActiveContractInFullRange">;
}

function makeAction(
  opts: {
    hasMemberActionEvent?: boolean;
    onboarding?: boolean;
  } = {},
): Params["action"] {
  const { hasMemberActionEvent = true, onboarding = false } = opts;
  return {
    events: hasMemberActionEvent
      ? [{ newStatus: ActionStatus.MemberAction, date: new Date("2020-01-01") }]
      : [
          {
            newStatus: ActionStatus.OfficeAction,
            date: new Date("2020-01-01"),
          },
        ],
    onboarding,
    // Mirrors the Action.memberActionPhase getter, which derives the phase
    // from `events`: no member-action event means an empty phase.
    memberActionPhase: hasMemberActionEvent
      ? {
          event: { date: new Date("2020-01-01") },
          deadlineEvent: { date: new Date("2020-02-01") },
        }
      : { event: null, deadlineEvent: null },
  } as unknown as Params["action"];
}

function makeUser(hasActiveContract: boolean): Params["user"] {
  return {
    contractEvents: [],
    hasActiveContractInFullRange: () => hasActiveContract,
  } as unknown as Params["user"];
}

function input(overrides: Partial<Params> = {}): Params {
  return {
    action: makeAction(),
    user: makeUser(true),
    inCohort: true,
    dismissed: false,
    ...overrides,
  };
}

describe("computeIsAssignedToAction", () => {
  it("participates when in cohort, with a contract active over the member action", () => {
    expect(computeIsAssignedToAction(input())).toBe(true);
  });

  it("does not participate for a logged-out viewer", () => {
    expect(computeIsAssignedToAction(input({ user: null }))).toBe(false);
  });

  it("does not participate when the action has no member-action event", () => {
    expect(
      computeIsAssignedToAction(
        input({ action: makeAction({ hasMemberActionEvent: false }) }),
      ),
    ).toBe(false);
  });

  it("does not participate when the user has dismissed the action", () => {
    expect(computeIsAssignedToAction(input({ dismissed: true }))).toBe(false);
  });

  it("does not participate when the user is not in the cohort", () => {
    expect(computeIsAssignedToAction(input({ inCohort: false }))).toBe(false);
  });

  describe("contract requirement", () => {
    it("does not participate without an active contract", () => {
      expect(computeIsAssignedToAction(input({ user: makeUser(false) }))).toBe(
        false,
      );
    });

    it("participates without an active contract for an onboarding action", () => {
      expect(
        computeIsAssignedToAction(
          input({
            action: makeAction({ onboarding: true }),
            user: makeUser(false),
          }),
        ),
      ).toBe(true);
    });
  });

  describe("onboarding join timing", () => {
    // Excluded even when in the cohort: onboarding targets new members only.
    it("excludes an existing member who joined before the phase began", () => {
      expect(
        computeIsAssignedToAction(
          input({
            action: makeAction({ onboarding: true }),
            user: userWithContractSignedAt(
              new Date(PHASE_START.getTime() - 1000),
            ),
          }),
        ),
      ).toBe(false);
    });

    it("includes a new member who joined at/after the phase began", () => {
      expect(
        computeIsAssignedToAction(
          input({
            action: makeAction({ onboarding: true }),
            user: userWithContractSignedAt(
              new Date(PHASE_START.getTime() + 1000),
            ),
          }),
        ),
      ).toBe(true);
    });
  });
});

describe("computeIsAssignedFromCohortSet", () => {
  type PopulationParams = Parameters<typeof computeIsAssignedFromCohortSet>[0];

  function makePopulationUser(opts: {
    id?: number;
    hasContractInFullRange?: boolean;
    contractSignedAt?: Date | null;
  }): {
    user: User;
    fullRangeCalls: { startDate?: Date | null; endDate?: Date | null }[];
  } {
    const {
      id = 1,
      hasContractInFullRange = true,
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
    } as unknown as User;
    return { user, fullRangeCalls };
  }

  function populationInput(
    overrides: Partial<PopulationParams> = {},
  ): PopulationParams {
    return {
      eventDate: PHASE_START,
      deadlineDate: new Date("2020-02-01"),
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
    // predicate (computeIsAssignedToAction).
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

  describe("onboarding join timing", () => {
    it("excludes an existing member who joined before the event", () => {
      const { user } = makePopulationUser({
        contractSignedAt: new Date(PHASE_START.getTime() - 1000),
      });
      expect(
        computeIsAssignedFromCohortSet(
          populationInput({ user, onboarding: true }),
        ),
      ).toBe(false);
    });

    it("includes a new member who joined at/after the event", () => {
      const { user } = makePopulationUser({
        contractSignedAt: new Date(PHASE_START.getTime() + 1000),
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
        user: userWithContractSignedAt(new Date(PHASE_START.getTime() - 1000)),
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
