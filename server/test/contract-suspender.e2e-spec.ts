import { R } from "@alliance/common/result";
import { Logger } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { ContractSuspenderWorker } from "src/actions/contract-suspender.worker";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import { ContractService } from "src/contract/contract.service";
import { EventLogService } from "src/eventlog/eventlog.service";
import { EmailType, Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationChannel } from "src/notifs/notif-utils";
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
import {
  createTestApp,
  setPreference,
  stubExpoClient,
  TestContext,
} from "./e2e-test-utils";

describe("ContractSuspenderWorker (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
  });

  beforeEach(() => stubExpoClient(ctx));

  afterAll(async () => {
    await ctx.app.close();
  });

  afterEach(() => jest.restoreAllMocks());

  const suspendable = async (label: string, pushOn: boolean) => {
    const ago = (days: number) => new Date(Date.now() - milliseconds({ days }));
    const member = await ctx.app.get(UserService).create({
      email: `suspension-${label}@example.com`,
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
      emailByDefault: false,
      textByDefault: false,
      pushByDefault: pushOn,
    });
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    const expoPushToken = `ExponentPushToken[suspension_${label}]`;
    await deviceRepo.save(
      deviceRepo.create({ user: member, deviceType: "iOS", expoPushToken }),
    );

    const suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    const actionRepo = ctx.dataSource.getRepository(Action);
    const eventRepo = ctx.dataSource.getRepository(ActionEvent);
    for (const deadlineDaysAgo of [21, 14, 7]) {
      const suite = await suiteRepo.save(
        suiteRepo.create({ name: `Suite ${deadlineDaysAgo} ${label}` }),
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
    return { member, expoPushToken };
  };

  it.each([
    {
      pushOn: true,
      pushed: [{ body: suspensionMessage.trim(), screen: "/membership" }],
    },
    { pushOn: false, pushed: [] },
  ])(
    "pushes the suspension notice by the push default past an Off override: $pushOn",
    async ({ pushOn, pushed }) => {
      const { member, expoPushToken } = await suspendable(
        `push-${pushOn}`,
        pushOn,
      );
      await setPreference(ctx, {
        userId: member.id,
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Push,
        enabled: false,
      });

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

  it.each([
    { textOn: true, unsubscribed: false, texted: 1, phone: "+14155550190" },
    { textOn: false, unsubscribed: false, texted: 0, phone: "+14155550191" },
    { textOn: true, unsubscribed: true, texted: 0, phone: "+14155550192" },
  ])(
    "texts the notice by the text default past an Off override, and never a stopped number: $textOn, stopped $unsubscribed",
    async ({ textOn, unsubscribed, texted, phone }) => {
      const { member } = await suspendable(`text-${phone}`, false);
      await ctx.dataSource.getRepository(User).update(member.id, {
        textByDefault: textOn,
        phoneNumber: phone,
        phoneNumberUnsubscribed: unsubscribed,
      });
      await setPreference(ctx, {
        userId: member.id,
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Text,
        enabled: false,
      });

      await ctx.app.get(ContractSuspenderWorker).processSuspensions();

      expect(
        await ctx.dataSource
          .getRepository(Mms)
          .countBy({ to: phone, body: suspensionMessage }),
      ).toBe(texted);
    },
  );

  it.each([
    { emailOn: true, mailed: 1 },
    { emailOn: false, mailed: 0 },
  ])(
    "emails the notice by the email default past an Off override: $emailOn",
    async ({ emailOn, mailed }) => {
      const { member } = await suspendable(`email-${emailOn}`, false);
      await ctx.dataSource
        .getRepository(User)
        .update(member.id, { emailByDefault: emailOn });
      await setPreference(ctx, {
        userId: member.id,
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Email,
        enabled: false,
      });

      await ctx.app.get(ContractSuspenderWorker).processSuspensions();

      expect(
        await ctx.dataSource.getRepository(Mail).countBy({
          to: member.email,
          emailType: EmailType.ContractSuspended,
        }),
      ).toBe(mailed);
    },
  );

  it("logs suspended and failed members by id, not name", async () => {
    const suspended = await suspendable("logged", false);
    const failing = await suspendable("log-failing", false);
    const contractService = ctx.app.get(ContractService);
    const original = contractService.suspendContract.bind(contractService);
    jest
      .spyOn(contractService, "suspendContract")
      .mockImplementation((params) =>
        params.userId === failing.member.id
          ? Promise.reject(new Error("suspend failed"))
          : original(params),
      );
    jest
      .spyOn(ctx.app.get(EventLogService), "sendMessage")
      .mockResolvedValue(R.success(undefined));
    const logs = [
      jest.spyOn(Logger.prototype, "log").mockImplementation(() => {}),
      jest.spyOn(Logger.prototype, "error").mockImplementation(() => {}),
      jest.spyOn(console, "log").mockImplementation(() => {}),
    ];

    await ctx.app.get(ContractSuspenderWorker).processSuspensions();

    const [log, error] = logs;
    for (const { member } of [suspended, failing]) {
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `^Suspending contracts for user\\(s\\) (.*, )?${member.id}(, |$)`,
          ),
        ),
      );
    }
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^Failed to suspend contract for user ${failing.member.id}, failure code `,
        ),
      ),
      expect.any(Error),
    );
    expect(
      logs
        .flatMap((spy) => spy.mock.calls.flat())
        .map(String)
        .join("\n"),
    ).not.toContain("Suspended Member");
  });
});
