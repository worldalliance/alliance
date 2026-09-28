import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { SingleMemberCohortService } from "../src/actions/single-member-cohort.service";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Cohort leaves reading another action's saved decisions (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    userRepo = ctx.dataSource.getRepository(User);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each([
    {
      type: "InProgressAction" as const,
      window: { start: addDays(now, -1), deadline: addDays(now, 3) },
    },
    {
      type: "MissedActionDeadline" as const,
      window: { start: addDays(now, -10), deadline: addDays(now, -3) },
    },
  ])(
    "reads $type from the branch a member was decided into after they move",
    async ({ type, window }) => {
      const member = await createUser({
        signedAt,
        timeZone: "America/New_York",
      });
      const us = await createAction({
        ...window,
        cohortExpression: { type: "USMember" },
      });
      const nonUs = await createAction({
        ...window,
        cohortExpression: { type: "NonUSMember" },
      });
      await ctx.dataSource.getRepository(ActionCohortDecision).save(
        [
          { actionId: us.id, included: true },
          { actionId: nonUs.id, included: false },
        ].map((row) => ({
          ...row,
          userId: member.id,
          reason: CohortDecisionReason.Launch,
          resolvedAt: window.start,
        })),
      );
      await userRepo.update(member.id, { timeZone: "Europe/London" });
      const user = await ctx.app.get(UserService).findOneOrFail(member.id, {
        tags: true,
        contractEvents: true,
        awayRanges: true,
      });

      const inLeaf = async (actionId: number) => {
        const expression = { type, actionId };
        const [population, single] = await Promise.all([
          ctx.app
            .get(ActionEventRecipientService)
            .resolveCohortMemberIds(expression),
          ctx.app.get(SingleMemberCohortService).computeIsInCohortExpression({
            user,
            cohortExpression: expression,
          }),
        ]);
        return { population: population.has(member.id), single };
      };
      expect(await inLeaf(us.id)).toEqual({ population: true, single: true });
      expect(await inLeaf(nonUs.id)).toEqual({
        population: false,
        single: false,
      });
    },
  );

  it("admits a member the upstream action has not decided yet", async () => {
    const member = await createUser({ signedAt });
    const window = { start: addDays(now, -1), deadline: addDays(now, 3) };
    const upstream = await createAction(window);
    const dependent = await createAction({
      ...window,
      cohortExpression: { type: "InProgressAction", actionId: upstream.id },
    });

    await ctx.app.get(CohortDecisionService).decideOpenAction(
      parseAction(
        await ctx.dataSource.getRepository(Action).findOneOrFail({
          where: { id: dependent.id },
          relations: { events: true },
        }),
      ),
      now,
    );

    expect((await decisionsFor(upstream.id)).has(member.id)).toBe(false);
    expect((await decisionsFor(dependent.id)).get(member.id)?.included).toBe(
      true,
    );
    expect(
      await ctx.app.get(SingleMemberCohortService).computeIsInCohortExpression({
        user: await ctx.app.get(UserService).findOneOrFail(member.id, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        }),
        cohortExpression: { type: "InProgressAction", actionId: upstream.id },
      }),
    ).toBe(true);
  });
});
