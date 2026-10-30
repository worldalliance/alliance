import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import type { ActionDto } from "../src/actions/dto/action.dto";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Member feed authors (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
  });

  afterAll(async () => {
    await actionRepo.query("DELETE FROM action");
    await ctx.app.close();
  });

  it("lists an action's authors", async () => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Authored Feed Action",
        category: [],
        body: "Body",
        shortDescription: "Short",
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
        authors: [{ id: ctx.adminUserId }],
      }),
    );
    const eventRepo = ctx.dataSource.getRepository(ActionEvent);
    await eventRepo.save(
      eventRepo.create({
        title: "Started",
        description: "",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ hours: 1 })),
        action,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/actions/loggedIn")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const served = (res.body as ActionDto[]).find(
      (item) => item.id === action.id,
    );

    expect(served?.authors?.map(({ id }) => id)).toEqual([ctx.adminUserId]);
  });
});
