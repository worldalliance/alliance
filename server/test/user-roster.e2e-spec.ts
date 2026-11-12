import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "../src/user/entities/user-away-range.entity";
import type { User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("UserService.findActiveUsersForRoster (e2e)", () => {
  let ctx: TestContext;
  let fixtures: CohortDecisionFixtures;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    fixtures = cohortDecisionFixtures(ctx);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource.query("DELETE FROM user_away_range");
    await fixtures.cleanUp();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const loaded = <T>(rows: T[] | undefined) => {
    if (!rows) throw new Error("relation not loaded");
    return rows;
  };

  const rosterProjection = (users: User[]) =>
    Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          contractEvents: loaded(user.contractEvents)
            .map(({ id, date, type }) => ({ id, date, type }))
            .sort((a, b) => a.id - b.id),
          awayRanges: loaded(user.awayRanges)
            .map(({ id, startDate, endDate }) => ({ id, startDate, endDate }))
            .sort((a, b) => a.id - b.id),
        },
      ]),
    );

  it("attaches the same live contract events and away ranges as the full load", async () => {
    const now = new Date();
    const member = await fixtures.createUser({ signedAt: addDays(now, -30) });
    await fixtures.createUser({});
    const contractEvents = ctx.dataSource.getRepository(ContractEvent);
    const deletedEvent = await contractEvents.save({
      user: { id: member.id },
      type: ContractEventType.SUSPENDED,
      date: addDays(now, -20),
      contract: { id: ctx.defaultContractId },
    });
    await contractEvents.softDelete(deletedEvent.id);
    const awayRanges = ctx.dataSource.getRepository(UserAwayRange);
    const [liveRange, deletedRange] = await awayRanges.save(
      [-5, -10].map((days) => ({
        userId: member.id,
        startDate: addDays(now, days),
        endDate: addDays(now, days + 1),
        reason: UserAwayRangeReason.VACATION,
      })),
    );
    await awayRanges.softDelete(deletedRange.id);

    const userService = ctx.app.get(UserService);
    const roster = rosterProjection(
      await userService.findActiveUsersForRoster(),
    );

    expect(roster[member.id].awayRanges.map(({ id }) => id)).toEqual([
      liveRange.id,
    ]);
    expect(roster[member.id].contractEvents).toHaveLength(1);
    expect(roster).toEqual(
      rosterProjection(await userService.findActiveUsersWithTags()),
    );
  });
});
