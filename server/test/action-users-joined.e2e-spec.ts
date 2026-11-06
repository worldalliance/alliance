import { ActionActivityType } from "@alliance/common/actionActivity";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { ActionActivityService } from "../src/actions/action-activity.service";
import { ActionParticipantsService } from "../src/actions/action-participants.service";
import { CohortResolutionSession } from "../src/actions/cohort-resolution-session";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "../src/user/entities/user-away-range.entity";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
  saveLiveCohortDecisions,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Action.usersJoined recomputation (e2e)", () => {
  let ctx: TestContext;
  let fixtures: CohortDecisionFixtures;
  let participants: ActionParticipantsService;

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([]);
    fixtures = cohortDecisionFixtures(ctx);
    participants = ctx.app.get(ActionParticipantsService);
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await ctx.dataSource.query("DELETE FROM user_away_range");
    await fixtures.cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const setUp = async () => {
    const { createUser, createAction } = fixtures;
    const signedAt = addDays(now, -30);
    const plain = await createUser({ signedAt });
    const away = await createUser({ signedAt });
    const withdrawn = await createUser({ signedAt });
    const completedOutsideCohort = await createUser({
      signedAt,
      tagged: false,
    });
    const savedExcluded = await createUser({ signedAt });
    const savedAdmitted = await createUser({ signedAt, tagged: false });
    await createUser({});

    const open = await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, 3),
    });
    const notStarted = await createAction({
      start: addDays(now, 5),
      deadline: addDays(now, 10),
    });
    await saveLiveCohortDecisions(ctx);
    const decisions = ctx.dataSource.getRepository(ActionCohortDecision);
    await decisions.update(
      { actionId: open.id, userId: savedExcluded.id },
      { included: false },
    );
    await decisions.update(
      { actionId: open.id, userId: savedAdmitted.id },
      { included: true },
    );
    await ctx.dataSource.getRepository(UserAwayRange).save({
      userId: away.id,
      startDate: addDays(now, -5),
      endDate: addDays(now, -4),
      reason: UserAwayRangeReason.VACATION,
    });
    const activities = ctx.app.get(ActionActivityService);
    for (const [user, type] of [
      [withdrawn, ActionActivityType.USER_WONT_COMPLETE],
      [completedOutsideCohort, ActionActivityType.USER_COMPLETED],
    ] as const) {
      await activities.createActionActivity({
        actionId: open.id,
        userId: user.id,
        type,
        adminCreated: true,
      });
    }
    return {
      open,
      notStarted,
      expected: {
        [open.id]: [plain, completedOutsideCohort, savedAdmitted],
        [notStarted.id]: [plain, away, withdrawn, savedExcluded],
      },
    };
  };

  const fullLoadParticipantIds = async (actionId: number) =>
    participants.findParticipantIdsForActions(
      [
        parseAction(
          await ctx.dataSource.getRepository(Action).findOneOrFail({
            where: { id: actionId },
            relations: { events: true, activities: true },
          }),
        ),
      ],
      { session: new CohortResolutionSession() },
    );

  const storedCounts = async () =>
    Object.fromEntries(
      (
        await ctx.dataSource
          .getRepository(Action)
          .find({ select: { id: true, usersJoined: true } })
      ).map((action) => [action.id, action.usersJoined]),
    );

  it("stores the counts the per-action, fully loaded path computes", async () => {
    const { expected } = await setUp();
    await ctx.dataSource.query(`UPDATE action SET "usersJoined" = -1`);

    await participants.reloadAllActionUsersJoined();
    const all = await storedCounts();
    await ctx.dataSource.query(`UPDATE action SET "usersJoined" = -1`);
    for (const actionId of Object.keys(expected).map(Number)) {
      await participants.reloadUsersJoinedForAction(actionId);
    }
    const single = await storedCounts();
    const reference = Object.fromEntries(
      await Promise.all(
        Object.keys(expected).map(async (id) => [
          Number(id),
          (await fullLoadParticipantIds(Number(id))).get(Number(id))!.sort(),
        ]),
      ),
    );

    const expectedIds = Object.fromEntries(
      Object.entries(expected).map(([id, users]) => [
        Number(id),
        users.map((user) => user.id).sort(),
      ]),
    );
    const expectedCounts = Object.fromEntries(
      Object.entries(expected).map(([id, users]) => [Number(id), users.length]),
    );
    expect({ reference, all, single }).toEqual({
      reference: expectedIds,
      all: expectedCounts,
      single: expectedCounts,
    });
  });

  it("loads the roster projection on the single-action path", async () => {
    const { open } = await setUp();
    const userService = ctx.app.get(UserService);
    const fullLoad = jest.spyOn(userService, "findActiveUsersWithTags");
    const rosterLoad = jest.spyOn(userService, "findActiveUsersForRoster");

    await participants.reloadUsersJoinedForAction(open.id);

    expect({
      fullLoads: fullLoad.mock.calls.length,
      rosterLoads: rosterLoad.mock.calls.length,
    }).toEqual({ fullLoads: 0, rosterLoads: 1 });
  });

  it("loads the saved decisions of every action in one query", async () => {
    const { open } = await setUp();
    const second = await fixtures.createAction({
      start: addDays(now, -10),
      deadline: addDays(now, 3),
    });
    await saveLiveCohortDecisions(ctx, [second.id]);
    const decisionFind = jest.spyOn(
      ctx.app.get<Repository<ActionCohortDecision>>(
        getRepositoryToken(ActionCohortDecision),
      ),
      "find",
    );
    const actions = await ctx.dataSource.getRepository(Action).find({
      where: [{ id: open.id }, { id: second.id }],
      relations: { events: true },
    });

    await participants.findParticipantIdsForActions(actions.map(parseAction));

    expect(decisionFind.mock.calls.length).toBe(1);
  });
});
