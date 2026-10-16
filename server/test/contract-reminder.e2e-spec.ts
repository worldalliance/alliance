import { Logger } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { ContractReminderWorker } from "src/actions/contract-reminder.worker";
import {
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import {
  CONTRACT_REMINDER_COPY,
  ContractReminderCopy,
} from "src/mail/contract-reminder-copy";
import { EmailStatus, EmailType, Mail } from "src/mail/mail.entity";
import { MailNotSentError, MailService } from "src/mail/mail.service";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "src/notifs/entities/experiment-assignment.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import { ContractReminderSentAt1792141515694 } from "../migrations/1792141515694-ContractReminderSentAt";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

describe("ContractReminderWorker (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const hoursAgo = (hours: number) =>
    new Date(Date.now() - milliseconds({ hours }));

  async function member(params: {
    email: string;
    createdAt?: Date;
    arm?: ExperimentArm;
  }): Promise<User> {
    const userRepo = ctx.dataSource.getRepository(User);
    const user = await userRepo.save(
      userRepo.create({
        email: params.email,
        password: "pass",
        name: "Pat Member",
        referralSource: ReferralSource.None,
        tags: [ctx.defaultTag],
      }),
    );
    await userRepo.update(user.id, {
      createdAt: params.createdAt ?? hoursAgo(25),
    });
    if (params.arm) {
      await ctx.dataSource.getRepository(ExperimentAssignment).save({
        userId: user.id,
        experiment: Experiment.ContractReminder,
        arm: params.arm,
      });
    }
    return user;
  }

  const remindersTo = (email: string) =>
    ctx.dataSource.getRepository(Mail).find({
      where: { to: email, emailType: EmailType.ContractReminder },
      withDeleted: true,
    });

  const trackingOf = (mail: Mail) =>
    ctx.dataSource
      .getRepository(MessageTracking)
      .findOneByOrFail({ trackingId: mail.cid ?? "" });

  const assignmentsOf = (userId: number) =>
    ctx.dataSource
      .getRepository(ExperimentAssignment)
      .findBy({ userId, experiment: Experiment.ContractReminder });

  const run = () => ctx.app.get(ContractReminderWorker).sendContractReminders();

  it("reminds eligible members once, with the copy of their saved arm", async () => {
    const control = await member({
      email: "control@example.com",
      arm: ExperimentArm.Control,
    });
    const variant = await member({
      email: "variant@example.com",
      arm: ExperimentArm.Variant,
    });
    const unassigned = await member({ email: "unassigned@example.com" });
    const tooNew = await member({
      email: "too-new@example.com",
      createdAt: hoursAgo(23),
    });
    const signed = await member({ email: "signed@example.com" });
    await giveActiveContract(ctx, signed.id);
    const reminded = await member({ email: "reminded@example.com" });
    await ctx.dataSource
      .getRepository(User)
      .update(reminded.id, { contractReminderSentAt: hoursAgo(1) });

    await run();
    await ctx.dataSource
      .getRepository(User)
      .update(control.id, { email: "control-renamed@example.com" });
    await run();

    for (const [user, copy, subject] of [
      [
        control,
        ContractReminderCopy.Control,
        "Sign your membership contract to participate in actions",
      ],
      [
        variant,
        ContractReminderCopy.AgreementV1,
        "The last step is entering into the membership agreement.",
      ],
    ] as const) {
      const mails = await remindersTo(user.email);
      expect(mails).toHaveLength(1);
      const tracking = await trackingOf(mails[0]);
      expect(tracking).toMatchObject({
        userId: user.id,
        source: MessageSource.ContractReminder,
        context: { contractReminderCopy: copy, subject },
      });
    }

    const unassignedMails = await remindersTo(unassigned.email);
    expect(unassignedMails).toHaveLength(1);
    const unassignedArms = await assignmentsOf(unassigned.id);
    expect(unassignedArms).toHaveLength(1);
    expect(await trackingOf(unassignedMails[0])).toMatchObject({
      context: {
        contractReminderCopy: CONTRACT_REMINDER_COPY[unassignedArms[0].arm],
      },
    });
    expect(await remindersTo("control-renamed@example.com")).toEqual([]);

    for (const user of [tooNew, signed, reminded]) {
      expect(await remindersTo(user.email)).toEqual([]);
      expect(await assignmentsOf(user.id)).toEqual([]);
    }
  });

  it("retries a member whose send failed with the arm already saved, without holding up others", async () => {
    const failing = await member({ email: "failing@example.com" });
    const next = await member({ email: "next@example.com" });
    const mailService = ctx.app.get(MailService);
    const original = mailService.sendContractReminderEmail.bind(mailService);
    const spy = jest
      .spyOn(mailService, "sendContractReminderEmail")
      .mockImplementation((params) =>
        params.userId === failing.id
          ? Promise.reject(new MailNotSentError("tracking insert failed"))
          : original(params),
      );
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await run();

    expect(error).toHaveBeenCalledWith(
      `Failed to send contract reminder to user ${failing.id}`,
      expect.any(Error),
    );
    error.mockRestore();
    expect(await remindersTo(failing.email)).toEqual([]);
    expect(await remindersTo(next.email)).toHaveLength(1);
    const [assignment] = await assignmentsOf(failing.id);

    spy.mockRestore();
    await ctx.dataSource
      .getRepository(User)
      .update(failing.id, { email: "failing-renamed@example.com" });
    await run();

    const [mail] = await remindersTo("failing-renamed@example.com");
    expect(await trackingOf(mail)).toMatchObject({
      context: { contractReminderCopy: CONTRACT_REMINDER_COPY[assignment.arm] },
    });
    expect(await assignmentsOf(failing.id)).toEqual([assignment]);
  });

  it("counts a send the mail server rejected as sent", async () => {
    const rejected = await member({ email: "rejected@example.com" });
    const mailService = ctx.app.get(MailService);
    const spy = jest
      .spyOn(mailService, "sendContractReminderEmail")
      .mockRejectedValue(new Error("mailgun unavailable"));
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await run();
    spy.mockRestore();
    error.mockRestore();
    await run();

    expect(await remindersTo(rejected.email)).toEqual([]);
    expect(
      await ctx.dataSource
        .getRepository(User)
        .findOneByOrFail({ id: rejected.id }),
    ).toMatchObject({ contractReminderSentAt: expect.any(Date) });
  });

  it("reminds once when marking the member as reminded fails", async () => {
    const unmarked = await member({ email: "unmarked@example.com" });
    const update = jest
      .spyOn(ctx.app.get<Repository<User>>(getRepositoryToken(User)), "update")
      .mockRejectedValueOnce(new Error("connection reset"));
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await run();
    update.mockRestore();
    error.mockRestore();
    await run();

    expect(await remindersTo(unmarked.email)).toHaveLength(1);
  });

  it("backfills from every past reminder to the member's current email", async () => {
    const migration = new ContractReminderSentAt1792141515694();
    const [earlier, later] = [hoursAgo(30), hoursAgo(10)];
    const mailRepo = ctx.dataSource.getRepository(Mail);
    const userRepo = ctx.dataSource.getRepository(User);
    const pastMail = async (params: {
      to: string;
      emailType: EmailType;
      status: EmailStatus;
      createdAt: Date;
      deleted?: boolean;
    }) => {
      const mail = await mailRepo.save(
        mailRepo.create({
          to: params.to,
          emailType: params.emailType,
          status: params.status,
        }),
      );
      await mailRepo.update(mail.id, { createdAt: params.createdAt });
      if (params.deleted) await mailRepo.softDelete(mail.id);
    };
    const statuses = [
      EmailStatus.Pending,
      EmailStatus.Failed,
      EmailStatus.Sent,
    ] as const;
    const byStatus = await Promise.all(
      statuses.map(async (status) => {
        const user = await member({ email: `backfill-${status}@example.com` });
        await pastMail({
          to: user.email,
          emailType: EmailType.ContractReminder,
          status,
          createdAt: later,
        });
        return user;
      }),
    );
    const twice = await member({ email: "backfill-twice@example.com" });
    for (const [createdAt, deleted] of [
      [earlier, true],
      [later, false],
    ] as const) {
      await pastMail({
        to: twice.email,
        emailType: EmailType.ContractReminder,
        status: EmailStatus.Sent,
        createdAt,
        deleted,
      });
    }
    const welcomed = await member({ email: "backfill-welcomed@example.com" });
    await pastMail({
      to: welcomed.email,
      emailType: EmailType.Welcome,
      status: EmailStatus.Sent,
      createdAt: later,
    });

    const runner = ctx.dataSource.createQueryRunner();
    try {
      await migration.down(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }

    const sentAt = async (user: User) =>
      (await userRepo.findOneByOrFail({ id: user.id })).contractReminderSentAt;
    for (const user of byStatus) {
      expect(await sentAt(user)).toEqual(later);
    }
    expect(await sentAt(twice)).toEqual(earlier);
    expect(await sentAt(welcomed)).toBeNull();
  });
});
