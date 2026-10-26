import { Logger } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { ContractReinstatedListener } from "src/actions/contract-reinstated.listener";
import { Action } from "src/actions/entities/action.entity";
import { ContractService } from "src/contract/contract.service";
import { EmailType, Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { Push } from "src/push/push.entity";
import { PushService } from "src/push/push.service";
import { tasksUrl } from "src/search/approutes";
import { TasksModule } from "src/tasks/tasks.module";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import {
  cohortDecisionFixtures,
  saveLiveCohortDecisions,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  setPreference,
  signAccessToken,
  stubExpoClient,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

const pushBody = "Your agreement has been reinstated.";
const textBody = () =>
  `Your agreement has been reinstated. Task assignment resumes with the next action. ${tasksUrl(true)}`;

type Defaults = Pick<
  User,
  "inAppByDefault" | "pushByDefault" | "textByDefault" | "emailByDefault"
>;
const allOn: Defaults = {
  inAppByDefault: true,
  pushByDefault: true,
  textByDefault: true,
  emailByDefault: true,
};

describe("Contract reinstated notifications (e2e)", () => {
  let ctx: TestContext;
  let memberCount = 0;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([TasksModule]);
  });

  beforeEach(() => stubExpoClient(ctx));

  afterAll(async () => {
    await ctx.app.close();
  });

  afterEach(() => jest.restoreAllMocks());

  const contracts = () => ctx.app.get(ContractService);

  const createMember = async (defaults: Defaults = allOn) => {
    memberCount++;
    const phoneNumber = `+1415555${String(1000 + memberCount)}`;
    const member = await ctx.app.get(UserService).create({
      email: `reinstated-${memberCount}@example.com`,
      password: "Password123!",
      name: "Robin Reinstated",
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: new Date(Date.now() - milliseconds({ days: 60 })),
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });
    await ctx.dataSource
      .getRepository(User)
      .update(member.id, { ...defaults, phoneNumber });
    const expoPushToken = `ExponentPushToken[reinstated_${memberCount}]`;
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    await deviceRepo.save(
      deviceRepo.create({ user: member, deviceType: "iOS", expoPushToken }),
    );
    return { member, phoneNumber, expoPushToken };
  };

  type Member = Awaited<ReturnType<typeof createMember>>;

  const suspend = (userId: number, automatic = false) =>
    contracts().suspendContract({
      userId,
      automatic,
      autoSuspendKey: automatic
        ? `reinstated-test-${userId}-${Date.now()}`
        : null,
    });

  const signViaService = (userId: number) =>
    contracts().signContract({
      userId,
      signedName: "Robin Reinstated",
      contractId: ctx.defaultContractId,
      viaTaskForm: false,
    });

  /** Runs `sign`, then waits for every delivery it started. */
  const signAndDeliver = async (sign: () => Promise<unknown>) => {
    const deliver = jest.spyOn(
      ctx.app.get(ContractReinstatedListener),
      "deliver",
    );
    await sign();
    await Promise.all(deliver.mock.results.map(({ value }) => value));
    deliver.mockRestore();
  };

  const notifsFor = (userId: number) =>
    ctx.dataSource.getRepository(Notification).find({
      where: {
        user: { id: userId },
        category: NotificationCategory.ContractReinstated,
      },
      order: { id: "ASC" },
    });

  const sent = async ({ member, phoneNumber, expoPushToken }: Member) => ({
    pushes: (
      await ctx.dataSource.getRepository(Push).findBy({ expoPushToken })
    ).map(({ body, screen }) => ({ body, screen })),
    texts: (
      await ctx.dataSource.getRepository(Mms).findBy({ to: phoneNumber })
    ).map(({ body }) => body),
    emails: await ctx.dataSource.getRepository(Mail).countBy({
      to: member.email,
      emailType: EmailType.ContractReinstated,
    }),
  });

  const everyChannelOnce = () => ({
    pushes: [{ body: pushBody, screen: "/tasks" }],
    texts: [textBody()],
    emails: 1,
  });

  const nothingSent = { pushes: [], texts: [], emails: 0 };

  it.each([
    { cause: "a voluntary pause", automatic: false },
    { cause: "an automatic suspension", automatic: true },
  ])(
    "announces the return from $cause, signed on the agreement page, on every channel",
    async ({ automatic }) => {
      const subject = await createMember();
      await suspend(subject.member.id, automatic);

      await signAndDeliver(() =>
        request(ctx.app.getHttpServer())
          .post(`/contract/sign/${ctx.defaultContractId}`)
          .set(
            "Authorization",
            `Bearer ${signAccessToken(ctx.jwtService, subject.member)}`,
          )
          .send({ signedName: "Robin Reinstated" })
          .expect(201),
      );

      expect(await notifsFor(subject.member.id)).toMatchObject([
        {
          message: pushBody,
          visible: true,
          webAppLocation: "/tasks",
          mobileAppLocation: "/tasks",
        },
      ]);
      expect(await sent(subject)).toEqual(everyChannelOnce());
    },
  );

  it("announces a return signed through a task form", async () => {
    const subject = await createMember();
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Rejoin",
      schema: {
        outputViews: [],
        pages: [
          {
            id: "page-1",
            fields: [
              {
                id: "sign",
                type: "input",
                kind: "contract",
                label: null,
                contractId: ctx.defaultContractId,
                signQuestion: "Sign?",
                yesLabel: "Yes",
                noLabel: "No",
              },
            ],
          },
        ],
      },
    });
    const action = await cohortDecisionFixtures(ctx).createAction({
      start: new Date(Date.now() - milliseconds({ days: 1 })),
      deadline: null,
      cohortExpression: { type: "Manual", userIds: [subject.member.id] },
    });
    await ctx.dataSource.getRepository(Action).update(action.id, {
      taskFormId: form.id,
      isContractSigningAction: true,
    });
    await saveLiveCohortDecisions(ctx, [action.id]);
    await suspend(subject.member.id, true);

    await signAndDeliver(() =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.id}`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, subject.member)}`,
        )
        .send({
          answers: { sign: true },
          formSnapshotId: snapshot.id,
          actionId: action.id,
          deviceType: "desktop",
        })
        .expect(201),
    );

    expect(await notifsFor(subject.member.id)).toHaveLength(1);
    expect(await sent(subject)).toEqual(everyChannelOnce());
  });

  it("announces neither a first signing nor a signing while active", async () => {
    const subject = await createMember();
    const unsigned = await ctx.app.get(UserService).create({
      email: `reinstated-first-${Date.now()}@example.com`,
      password: "Password123!",
      name: "First Signer",
      tags: [ctx.defaultTag],
    });

    await signAndDeliver(() => signViaService(unsigned.id));
    await signAndDeliver(() => signViaService(subject.member.id));

    expect(await notifsFor(unsigned.id)).toEqual([]);
    expect(await notifsFor(subject.member.id)).toEqual([]);
    expect(await sent(subject)).toEqual(nothingSent);
  });

  it("announces racing signings of one return once, and a later return again", async () => {
    const subject = await createMember();
    await suspend(subject.member.id);
    const suspension = await ctx.dataSource
      .getRepository(ContractEvent)
      .findOneByOrFail({
        user: { id: subject.member.id },
        type: ContractEventType.SUSPENDED,
      });
    const holder = ctx.dataSource.createQueryRunner();
    await holder.startTransaction();
    await holder.manager.findOneOrFail(ContractEvent, {
      where: { id: suspension.id },
      lock: { mode: "pessimistic_write" },
    });

    const signings = signAndDeliver(() =>
      Promise.all([
        signViaService(subject.member.id),
        signViaService(subject.member.id),
      ]),
    );
    await waitForLockWait(ctx.dataSource, 2);
    await holder.commitTransaction();
    await holder.release();
    await signings;
    expect(await notifsFor(subject.member.id)).toHaveLength(1);
    expect(await sent(subject)).toEqual(everyChannelOnce());

    await suspend(subject.member.id);
    await signAndDeliver(() => signViaService(subject.member.id));
    expect(await notifsFor(subject.member.id)).toHaveLength(2);
    expect((await sent(subject)).emails).toBe(2);
  });

  it.each([
    { label: "defaults on, overridden off", defaultOn: true, override: false },
    { label: "defaults off, overridden on", defaultOn: false, override: true },
    { label: "defaults on", defaultOn: true, override: null },
    { label: "defaults off", defaultOn: false, override: null },
  ])(
    "follows each channel's default and override: $label",
    async ({ defaultOn, override }) => {
      const subject = await createMember({
        inAppByDefault: defaultOn,
        pushByDefault: defaultOn,
        textByDefault: defaultOn,
        emailByDefault: defaultOn,
      });
      if (override !== null) {
        for (const channel of Object.values(NotificationChannel)) {
          await setPreference(ctx, {
            userId: subject.member.id,
            kind: NotificationKind.ContractReinstated,
            channel,
            enabled: override,
          });
        }
      }
      await suspend(subject.member.id);

      await signAndDeliver(() => signViaService(subject.member.id));

      const wanted = override ?? defaultOn;
      expect(await notifsFor(subject.member.id)).toMatchObject([
        { visible: wanted },
      ]);
      expect(await sent(subject)).toEqual(
        wanted ? everyChannelOnce() : nothingSent,
      );
    },
  );

  it("pushes with in-app off", async () => {
    const subject = await createMember({
      ...allOn,
      textByDefault: false,
      emailByDefault: false,
    });
    await setPreference(ctx, {
      userId: subject.member.id,
      kind: NotificationKind.ContractReinstated,
      channel: NotificationChannel.InApp,
      enabled: false,
    });
    await suspend(subject.member.id);

    await signAndDeliver(() => signViaService(subject.member.id));

    expect(await notifsFor(subject.member.id)).toMatchObject([
      { visible: false },
    ]);
    expect(await sent(subject)).toEqual({
      ...nothingSent,
      pushes: [{ body: pushBody, screen: "/tasks" }],
    });
  });

  it("never texts a stopped number", async () => {
    const subject = await createMember();
    await ctx.dataSource
      .getRepository(User)
      .update(subject.member.id, { phoneNumberUnsubscribed: true });
    await suspend(subject.member.id);

    await signAndDeliver(() => signViaService(subject.member.id));

    expect((await sent(subject)).texts).toEqual([]);
  });

  it.each([
    {
      channel: NotificationChannel.Push,
      fail: () =>
        jest
          .spyOn(ctx.app.get(PushService), "sendMessages")
          .mockRejectedValue(new Error("push down")),
      rest: () => ({ ...everyChannelOnce(), pushes: [] }),
    },
    {
      channel: NotificationChannel.Text,
      fail: () =>
        jest
          .spyOn(ctx.app.get(MmsService), "sendMms")
          .mockRejectedValue(new Error("text down")),
      rest: () => ({ ...everyChannelOnce(), texts: [] }),
    },
    {
      channel: NotificationChannel.Email,
      fail: () =>
        jest
          .spyOn(ctx.app.get(MailService), "sendContractReinstatedEmail")
          .mockRejectedValue(new Error("email down")),
      rest: () => ({ ...everyChannelOnce(), emails: 0 }),
    },
  ])(
    "keeps the signing and the other channels when $channel fails, without retrying it",
    async ({ channel, fail, rest }) => {
      const subject = await createMember();
      await suspend(subject.member.id);
      const failing = fail();
      const error = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => {});

      await signAndDeliver(() => signViaService(subject.member.id));

      expect(
        (
          await ctx.app.get(UserService).findOneOrFail(subject.member.id, {
            contractEvents: true,
          })
        ).hasActiveContract,
      ).toBe(true);
      expect(await sent(subject)).toEqual(rest());
      expect(failing).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        `Failed to send reinstatement ${channel} to user ${subject.member.id}`,
        expect.any(Error),
      );
    },
  );

  it.each([
    { label: "paused again", signsAgain: false },
    { label: "paused and reinstated again", signsAgain: true },
  ])(
    "skips a pending delivery once $label, keeping its inbox entry",
    async ({ signsAgain }) => {
      const subject = await createMember();
      await suspend(subject.member.id);
      const listener = ctx.app.get(ContractReinstatedListener);
      const deliver = listener.deliver.bind(listener);
      const held = jest.spyOn(listener, "deliver").mockResolvedValue();

      await signViaService(subject.member.id);
      const [pendingId] = held.mock.calls[0];
      held.mockRestore();
      await suspend(subject.member.id);
      if (signsAgain) {
        await signAndDeliver(() => signViaService(subject.member.id));
      }

      await deliver(pendingId);

      expect(await notifsFor(subject.member.id)).toHaveLength(
        signsAgain ? 2 : 1,
      );
      expect(await sent(subject)).toEqual(
        signsAgain ? everyChannelOnce() : nothingSent,
      );
    },
  );
});
