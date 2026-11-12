import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

// Clients keep one record per activity whatever endpoint sent it, so every
// endpoint has to send the same note and author.
describe("Activity records across endpoints (e2e)", () => {
  let ctx: TestContext;
  let action: Action;
  let activityId: number;
  let community: Community;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    action = await ctx.dataSource.getRepository(Action).save({
      name: "Activity records action",
      category: [],
      body: "",
      status: ActionStatus.MemberAction,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Action Started",
      description: "",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ hours: 1 })),
      action,
    });
    const userRepo = ctx.dataSource.getRepository(User);
    await userRepo.update(ctx.testUserId, { ambassador: true });
    const author = await userRepo.findOneByOrFail({ id: ctx.testUserId });
    community = await ctx.dataSource.getRepository(Community).save({
      name: "Activity records group",
      description: "",
      leaders: [author],
      users: [author],
    });
    const activity = await ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: ctx.testUserId,
      type: ActionActivityType.USER_COMPLETED,
      editableContent: { body: "My note", attachments: [] },
    });
    activityId = activity.id;
  }, 50000);

  afterAll(async () => {
    await ctx.dataSource.getRepository(Action).delete(action.id);
    await ctx.dataSource.getRepository(Community).delete(community.id);
    await closeTestApp(ctx.app);
  });

  const get = (path: string) =>
    request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

  it("sends the activity's note and author badges from every endpoint", async () => {
    const actionList = await get(`/actions/${action.id}/activities`);
    const completed = await get(`/actions/completed/${ctx.testUserId}`);
    const profileFeed = await get(`/actions/userFeed/${ctx.testUserId}`);
    const detail = await get(`/actions/activities/${activityId}`);

    const records = [
      actionList.body.find(({ id }: { id: number }) => id === activityId),
      completed.body.find(({ id }: { id: number }) => id === activityId),
      profileFeed.body.find(
        ({ activity }: { activity?: { id: number } }) =>
          activity?.id === activityId,
      )?.activity,
      detail.body,
    ];

    for (const record of records)
      expect(record).toMatchObject({
        editableContent: { body: "My note" },
        user: { ambassador: true, isCommunityLeader: true },
      });
  });
});
