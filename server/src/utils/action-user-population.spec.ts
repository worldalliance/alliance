import { millisecondsInSecond } from "date-fns/constants";
import type { User } from "../user/entities/user.entity";
import { computeIsAssignedFromCohortSet } from "./action-user";

const PHASE_START = new Date("2020-01-01");
const DEADLINE = new Date("2020-02-01");

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
      onboarding: false,
      ...overrides,
    };
  }

  it("participates when in cohort with a contract active over the window", () => {
    expect(computeIsAssignedFromCohortSet(populationInput())).toBe(true);
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
