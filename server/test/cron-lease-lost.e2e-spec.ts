import { LockLostError, Locks } from "@nestjs/locks";
import { milliseconds } from "date-fns";
import { ContractReminderWorker } from "src/actions/contract-reminder.worker";
import { Lease } from "src/leases/lease.entity";
import { EmailType, Mail } from "src/mail/mail.entity";
import { MailService } from "src/mail/mail.service";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { In } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

const KEY = "test:lease-lost";

describe("a leased run that loses its lease (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("takes no new item after another holder takes the lease over", async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const emails = ["first@example.com", "second@example.com"];
    for (const email of emails) {
      const user = await userRepo.save(
        userRepo.create({
          email,
          password: "pass",
          name: "Pat Member",
          referralSource: ReferralSource.None,
          tags: [ctx.defaultTag],
        }),
      );
      await userRepo.update(user.id, {
        createdAt: new Date(Date.now() - milliseconds({ hours: 25 })),
      });
    }

    const mail = ctx.app.get(MailService);
    const send = mail.sendContractReminderEmail.bind(mail);
    const spy = jest
      .spyOn(mail, "sendContractReminderEmail")
      .mockImplementation(async (params) => {
        const result = await send(params);
        await ctx.dataSource
          .getRepository(Lease)
          .update({ key: KEY }, { owner: "another-process" });
        await new Promise((resolve) => setTimeout(resolve, 500));
        return result;
      });

    try {
      const run = ctx.app
        .get(Locks)
        .withLock(
          KEY,
          () => ctx.app.get(ContractReminderWorker).sendDueReminders(),
          {
            ttl: "300ms",
          },
        );

      await expect(run).rejects.toBeInstanceOf(LockLostError);
      const sent = await ctx.dataSource.getRepository(Mail).count({
        where: { to: In(emails), emailType: EmailType.ContractReminder },
        withDeleted: true,
      });
      expect(sent).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
