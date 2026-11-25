import { ActionActivityType } from "@alliance/common/actionActivity";
import { addDays, milliseconds } from "date-fns";
import { ActionUpdateRecognitionService } from "src/actions/action-update-recognition.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionUpdateExposure } from "src/actions/entities/action-update-exposure.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import { Tag } from "src/user/entities/tag.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  createTestApp,
  giveActiveContract,
  stubExpoClient,
  type TestContext,
} from "./e2e-test-utils";

/** Starts an app with an action whose recognition updates go to `audience`. */
export async function setUpRecognition() {
  process.env.SEND_DEV_NOTIFS = "1";
  const ctx = await createTestApp([]);
  stubExpoClient(ctx);
  const recognition = ctx.app.get(ActionUpdateRecognitionService);
  const audience = await ctx.dataSource
    .getRepository(Tag)
    .save({ name: "Recognition audience", description: "" });
  const action = await ctx.dataSource.getRepository(Action).save({
    name: "Write to your representative",
    category: [],
    body: "Body",
    shortDescription: "Short",
    visibilityMode: VisibilityMode.Public,
    cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
  });
  await ctx.dataSource.getRepository(ActionEvent).save({
    title: "Launch",
    description: "Live",
    newStatus: ActionStatus.MemberAction,
    date: addDays(new Date(), -30),
    action,
  });
  return recognitionFixture({ ctx, recognition, audience, action });
}

export type RecognitionFixture = ReturnType<typeof recognitionFixture>;

function recognitionFixture(params: {
  ctx: TestContext;
  recognition: ActionUpdateRecognitionService;
  audience: Tag;
  action: Action;
}) {
  const { ctx, recognition, audience, action } = params;
  let memberCount = 0;

  const admin = (
    method: "post" | "patch",
    path: string,
    body?: Record<string, unknown>,
  ) =>
    request(ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const createMember = async (
    options: { inAudience?: boolean; inCohort?: boolean } = {},
  ) => {
    const index = ++memberCount;
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        email: `recognition-${index}@example.com`,
        password: "pass",
        name: `Member${index} Example`,
        referralSource: ReferralSource.None,
        phoneNumber: `+1415555${String(1000 + index)}`,
        tags: [
          ...(options.inAudience === false ? [] : [audience]),
          ...(options.inCohort ? [ctx.defaultTag] : []),
        ],
      }),
    );
    await giveActiveContract(ctx, user.id);
    if (options.inCohort) {
      // Assigned only with a contract held since the action launched.
      await ctx.dataSource
        .getRepository(ContractEvent)
        .update({ user: { id: user.id } }, { date: addDays(new Date(), -60) });
    }
    await ctx.dataSource.getRepository(UserDevice).save({
      user: { id: user.id },
      expoPushToken: `ExponentPushToken[recognition-${index}]`,
    });
    return user;
  };

  const complete = (user: User) =>
    ctx.dataSource.getRepository(ActionActivity).save({
      actionId: action.id,
      userId: user.id,
      type: ActionActivityType.USER_COMPLETED,
    });

  const createUpdate = async (body: Record<string, unknown> = {}) => {
    const created = await admin("post", `/actions/createUpdate/${action.id}`, {
      title: "Recognition",
      shortNotifString: "a hearing on the bill",
      nonCompleterResult: "a hearing on the bill",
      date: new Date(Date.now() - milliseconds({ minutes: 1 })).toISOString(),
      notifyType: "tag",
      tagId: audience.id,
      ...body,
    }).expect(201);
    await admin("patch", `/actions/updateUpdate/${created.body.id}`, {
      schema: {
        blocks: [{ type: "display", kind: "header", id: "b1", text: "Body" }],
      },
      expectedSchemaSnapshotId: created.body.schemaSnapshotId,
    }).expect(200);
    const id: number = created.body.id;
    return id;
  };

  const notify = (id: number) => admin("post", `/actions/updates/${id}/notify`);

  const exposureOf = (updateId: number, userId: number) =>
    ctx.dataSource.getRepository(ActionUpdateExposure).findOneOrFail({
      where: { actionUpdateId: updateId, userId },
      relations: { mail: true, mms: true, unreadContent: true },
    });

  const entriesFor = (updateId: number) =>
    ctx.dataSource.getRepository(UnreadContent).find({
      where: {
        contentType: UnreadContentType.ActionUpdate,
        contentId: updateId,
      },
      relations: { user: true },
    });

  const deliverAll = async () => {
    let more = true;
    while (more) {
      more = await recognition.deliverPrepared();
    }
  };

  const reset = async () => {
    await ctx.dataSource.query("DELETE FROM action_update");
    await ctx.dataSource.query("DELETE FROM action_activity");
    await ctx.dataSource.query(
      'DELETE FROM tag_users_user WHERE "tagId" = $1',
      [audience.id],
    );
  };

  return {
    ctx,
    recognition,
    audience,
    action,
    admin,
    createMember,
    complete,
    createUpdate,
    notify,
    exposureOf,
    entriesFor,
    deliverAll,
    reset,
  };
}
