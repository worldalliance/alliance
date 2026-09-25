import request from "supertest";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { Action } from "../src/actions/entities/action.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Cohort decision staff tooling (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const patchAction = (actionId: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  describe("optionality", () => {
    it("rejects changing optional once the action has decisions", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await service.resolveAll(now);

      expect((await patchAction(action.id, { optional: true })).status).toBe(
        400,
      );
      expect(
        (await actionRepo.findOneByOrFail({ id: action.id })).optional,
      ).toBe(false);
      expect((await patchAction(action.id, { optional: false })).status).toBe(
        200,
      );
    });

    it("allows changing optional before any decision", async () => {
      const action = await createAction({
        start: addDays(now, 1),
        deadline: addDays(now, 3),
      });

      expect((await patchAction(action.id, { optional: true })).status).toBe(
        200,
      );
      expect(
        (await actionRepo.findOneByOrFail({ id: action.id })).optional,
      ).toBe(true);
    });
  });
});
