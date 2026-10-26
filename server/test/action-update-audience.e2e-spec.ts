import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

describe("Action update audience (e2e)", () => {
  let ctx: TestContext;
  let testAction: Action;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    testAction = await ctx.dataSource.getRepository(Action).save({
      name: "Audience Action",
      category: [],
      body: "Body",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ hours: 1 })),
      action: testAction,
    });
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const createUser = (name: string) => {
    const users = ctx.dataSource.getRepository(User);
    return users.save(
      users.create({
        email: `${name}@example.com`,
        password: "pass",
        name,
        referralSource: ReferralSource.None,
      }),
    );
  };

  const notifyAllMembers = async () => {
    const server = ctx.app.getHttpServer();
    const auth = `Bearer ${ctx.adminAccessToken}`;
    const created = await request(server)
      .post(`/actions/createUpdate/${testAction.id}`)
      .set("Authorization", auth)
      .send({
        title: "Audience",
        shortNotifString: "something happened",
        date: new Date().toISOString(),
        notifyType: "all_members",
        notificationMode: "normal",
      })
      .expect(201);
    await request(server)
      .patch(`/actions/updateUpdate/${created.body.id}`)
      .set("Authorization", auth)
      .send({
        schema: {
          blocks: [{ type: "display", kind: "header", id: "b1", text: "Body" }],
        },
        expectedSchemaSnapshotId: created.body.schemaSnapshotId,
      })
      .expect(200);
    await request(server)
      .post(`/actions/updates/${created.body.id}/notify`)
      .set("Authorization", auth)
      .expect(200);
    const rows = await ctx.dataSource.getRepository(UnreadContent).find({
      where: {
        contentType: UnreadContentType.ActionUpdate,
        contentId: created.body.id,
      },
      relations: { user: true },
    });
    return rows.map((row) => row.user?.id);
  };

  it("reaches only users with an active contract", async () => {
    const signed = await createUser("signed");
    await giveActiveContract(ctx, signed.id);
    const unsigned = await createUser("unsigned");
    const suspended = await createUser("suspended");
    const hoursAgo = (hours: number) =>
      new Date(Date.now() - milliseconds({ hours }));
    await ctx.dataSource.getRepository(ContractEvent).save([
      {
        user: { id: suspended.id },
        type: ContractEventType.SIGNED,
        date: hoursAgo(2),
        contract: { id: ctx.defaultContractId },
      },
      {
        user: { id: suspended.id },
        type: ContractEventType.SUSPENDED,
        date: hoursAgo(1),
        contract: { id: ctx.defaultContractId },
      },
    ]);

    const recipients = await notifyAllMembers();

    expect(recipients).toContain(signed.id);
    expect(recipients).not.toContain(unsigned.id);
    expect(recipients).not.toContain(suspended.id);
  });
});
