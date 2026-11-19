import { R } from "@alliance/common/result";
import { BadRequestException, Logger } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { ContractSuspenderWorker } from "src/actions/contract-suspender.worker";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { ContractService } from "src/contract/contract.service";
import { renderEvent } from "src/eventlog/event-messages";
import { EventLogService } from "src/eventlog/eventlog.service";
import { EmailType, Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { suspensionMessage } from "src/notifs/textnotifcontents";
import { Push } from "src/push/push.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { EntityManager } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import {
  closeTestApp,
  createTestApp,
  setPreference,
  stubExpoClient,
  TestContext,
} from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

describe("ContractSuspenderWorker (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
  });

  beforeEach(() => stubExpoClient(ctx));

  afterAll(async () => {
    await closeTestApp(ctx.app);
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

  it.each([
    {
      kind: "automatic",
      suspend: () => ctx.app.get(ContractSuspenderWorker).processSuspensions(),
      message:
        "Contract suspended automatically for Suspended Member (invited by Inviting Member): they missed 3 action suites in a row.",
    },
    {
      kind: "manual",
      suspend: (userId: number) =>
        ctx.app.get(ContractService).suspendContract({ userId }),
      message:
        "Suspended Member (invited by Inviting Member) suspended their contract.",
    },
  ])(
    "names who invited the member in the $kind suspension alert",
    async ({ kind, suspend, message }) => {
      const { member } = await suspendable(`invited-${kind}`, false);
      const referrer = await ctx.app.get(UserService).create({
        email: `suspension-referrer-${kind}@example.com`,
        password: "Password123!",
        name: "Inviting Member",
        tags: [ctx.defaultTag],
      });
      await ctx.dataSource.getRepository(User).update(member.id, {
        referredById: referrer.id,
        referralSource: ReferralSource.ReferralLink,
      });
      const sendMessage = jest
        .spyOn(ctx.app.get(EventLogService), "sendMessage")
        .mockResolvedValue(R.success(undefined));

      await suspend(member.id);

      const [[event]] = sendMessage.mock.calls;
      expect(event).toMatchObject({ userId: member.id });
      expect(renderEvent(event).message).toBe(message);
    },
  );

  const memberWithLeader = async (label: string) => {
    const { member } = await suspendable(label, false);
    await ctx.dataSource
      .getRepository(User)
      .update(member.id, { emailByDefault: true });
    const userRepo = ctx.dataSource.getRepository(User);
    const leader = await userRepo.save(
      userRepo.create({
        name: "Overlap Leader",
        email: `suspension-${label}-leader@example.com`,
        password: "Password123!",
      }),
    );
    const communityRepo = ctx.dataSource.getRepository(Community);
    await communityRepo.save(
      communityRepo.create({
        name: "Overlap Community",
        description: "Overlap",
        leaders: [leader],
        users: [leader, member],
      }),
    );
    jest
      .spyOn(ctx.app.get(EventLogService), "sendMessage")
      .mockResolvedValue(R.success(undefined));
    return { member, leader };
  };

  const suspensionsAndRemovalNotices = async (params: {
    member: User;
    leader: User;
  }) => ({
    suspensions: await ctx.dataSource.getRepository(ContractEvent).countBy({
      user: { id: params.member.id },
      type: ContractEventType.SUSPENDED,
    }),
    removalNotices: await ctx.dataSource.getRepository(Notification).countBy({
      user: { id: params.leader.id },
      category: NotificationCategory.MemberSuspendedRemovedFromCommunity,
    }),
  });

  it("suspends and notifies once when two runs overlap", async () => {
    const { member, leader } = await memberWithLeader("overlap");
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const worker = ctx.app.get(ContractSuspenderWorker);

    await Promise.all([worker.suspendDue(), worker.suspendDue()]);

    expect(await suspensionsAndRemovalNotices({ member, leader })).toEqual({
      suspensions: 1,
      removalNotices: 1,
    });
    expect(
      await ctx.dataSource.getRepository(Mail).countBy({
        to: member.email,
        emailType: EmailType.ContractSuspended,
      }),
    ).toBe(1);
  });

  it("suspends once when two manual suspensions race", async () => {
    const { member, leader } = await memberWithLeader("manual-race");
    const contractService = ctx.app.get(ContractService);
    const findBy = EntityManager.prototype.findBy;
    const bothRead = rendezvous({ parties: 2, timeoutMs: 500 });
    const read = jest
      .spyOn(EntityManager.prototype, "findBy")
      .mockImplementation(async function (this: EntityManager, entity, where) {
        const rows = await findBy.call(this, entity, where);
        if (entity === ContractEvent) await bothRead();
        return rows;
      });

    const results = await Promise.allSettled([
      contractService.suspendContract({ userId: member.id }),
      contractService.suspendContract({ userId: member.id }),
    ]);
    read.mockRestore();

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(
      results.find((result) => result.status === "rejected")?.reason,
    ).toBeInstanceOf(BadRequestException);
    expect(await suspensionsAndRemovalNotices({ member, leader })).toEqual({
      suspensions: 1,
      removalNotices: 1,
    });
  });

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
