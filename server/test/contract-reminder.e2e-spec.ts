import { Logger } from "@nestjs/common";
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
import { MailService } from "src/mail/mail.service";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "src/notifs/entities/experiment-assignment.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
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
    const otherEmail = await member({ email: "other-email@example.com" });
    const mailRepo = ctx.dataSource.getRepository(Mail);
    await mailRepo.save(
      mailRepo.create({
        to: otherEmail.email,
        emailType: EmailType.Welcome,
        status: EmailStatus.Sent,
      }),
    );
    const suppressed = await Promise.all(
      [EmailStatus.Pending, EmailStatus.Failed, null].map(async (status, i) => {
        const user = await member({ email: `suppressed-${i}@example.com` });
        const mail = await mailRepo.save(
          mailRepo.create({
            to: user.email,
            emailType: EmailType.ContractReminder,
            status: status ?? EmailStatus.Sent,
          }),
        );
        if (status === null) await mailRepo.softDelete(mail.id);
        return user;
      }),
    );

    await run();
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
    expect(await remindersTo(otherEmail.email)).toHaveLength(1);

    for (const user of [tooNew, signed]) {
      expect(await remindersTo(user.email)).toEqual([]);
      expect(await assignmentsOf(user.id)).toEqual([]);
    }
    for (const user of suppressed) {
      expect(await remindersTo(user.email)).toHaveLength(1);
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
          ? Promise.reject(new Error("tracking insert failed"))
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
});
