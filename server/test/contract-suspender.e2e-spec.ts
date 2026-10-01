import { milliseconds } from "date-fns";
import { ContractSuspenderWorker } from "src/actions/contract-suspender.worker";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import { suspensionMessage } from "src/notifs/textnotifcontents";
import { Push } from "src/push/push.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, stubExpoClient, TestContext } from "./e2e-test-utils";

describe("ContractSuspenderWorker (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    stubExpoClient(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it.each([
    {
      pushOn: true,
      pushed: [{ body: suspensionMessage.trim(), screen: "/membership" }],
    },
    { pushOn: false, pushed: [] },
  ])(
    "pushes the suspension notice only with push on: $pushOn",
    async ({ pushOn, pushed }) => {
      const ago = (days: number) =>
        new Date(Date.now() - milliseconds({ days }));
      const member = await ctx.app.get(UserService).create({
        email: `suspension-push-${pushOn}@example.com`,
        password: "Password123!",
        name: "Suspended Member",
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: ago(60),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
      });
      await ctx.dataSource.getRepository(User).update(member.id, {
        emailNotifsForActions: false,
        textNotifsForActions: false,
        pushNotifsForActions: pushOn,
      });
      const deviceRepo = ctx.dataSource.getRepository(UserDevice);
      const expoPushToken = `ExponentPushToken[suspension_push_${pushOn}]`;
      await deviceRepo.save(
        deviceRepo.create({ user: member, deviceType: "iOS", expoPushToken }),
      );

      const suiteRepo = ctx.dataSource.getRepository(ActionSuite);
      const actionRepo = ctx.dataSource.getRepository(Action);
      const eventRepo = ctx.dataSource.getRepository(ActionEvent);
      for (const deadlineDaysAgo of [21, 14, 7]) {
        const suite = await suiteRepo.save(
          suiteRepo.create({ name: `Suite ${deadlineDaysAgo} ${pushOn}` }),
        );
        const action = await actionRepo.save(
          actionRepo.create({
            name: `Task ${deadlineDaysAgo}`,
            category: [],
            body: "Body",
            shortDescription: "Short",
            suite,
            cohortExpression: { type: "Manual", userIds: [member.id] },
          }),
        );
        await eventRepo.save([
          eventRepo.create({
            title: "Member phase",
            description: "Member phase",
            newStatus: ActionStatus.MemberAction,
            date: ago(deadlineDaysAgo + 5),
            action,
          }),
          eventRepo.create({
            title: "Deadline",
            description: "Office phase",
            newStatus: ActionStatus.OfficeAction,
            date: ago(deadlineDaysAgo),
            action,
          }),
        ]);
      }
      await saveLiveCohortDecisions(ctx);

      await ctx.app.get(ContractSuspenderWorker).processSuspensions();

      expect(
        await ctx.dataSource.getRepository(ContractEvent).existsBy({
          user: { id: member.id },
          type: ContractEventType.SUSPENDED,
        }),
      ).toBe(true);
      const pushes = await ctx.dataSource
        .getRepository(Push)
        .find({ where: { expoPushToken } });
      expect(pushes.map(({ body, screen }) => ({ body, screen }))).toEqual(
        pushed,
      );
    },
  );
});
