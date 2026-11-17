import { subMinutes } from "date-fns";
import request from "supertest";
import type { Repository } from "typeorm";
import { z } from "zod";
import { EmailStatus, Mail } from "../src/mail/mail.entity";
import { MailService } from "../src/mail/mail.service";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "../src/waitlist/entities/waitlist-email-recipient.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistEmailSender } from "../src/waitlist/waitlist-email-sender.service";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import {
  mailWith,
  postWaitlistEmail,
  saveWaitlistEntry,
} from "./waitlist-email-fixtures";

describe("Waitlist email sending when runs overlap (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let recipientRepo: Repository<WaitlistEmailRecipient>;
  let sender: WaitlistEmailSender;
  let sendStaff: jest.SpyInstance;

  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  /** Queues one recipient without sending it; the tests run the sender. */
  const queue = async ({ mobilize = false } = {}) => {
    const entry = await saveWaitlistEntry(ctx);
    const res = await postWaitlistEmail(ctx, {
      mobilize,
      entryIds: [entry.id],
    });
    return z.object({ id: z.number() }).parse(res.body).id;
  };

  const recipientOf = (batchId: number) =>
    recipientRepo.findOneByOrFail({ batchId });

  const holdNextSend = () => {
    const started = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<Mail>();
    sendStaff.mockImplementationOnce(() => {
      started.resolve();
      return answer.promise;
    });
    return { started: started.promise, answer };
  };

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    recipientRepo = ctx.dataSource.getRepository(WaitlistEmailRecipient);
    sender = ctx.app.get(WaitlistEmailSender);
    sendStaff = jest.spyOn(ctx.app.get(MailService), "sendWaitlistStaffEmail");
    jest.spyOn(sender, "run").mockResolvedValue();
  }, 50000);

  beforeEach(() => {
    sendStaff.mockReset();
    sendStaff.mockResolvedValue(mailWith(EmailStatus.Sent));
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("leaves a recipient another run is still sending alone", async () => {
    const batchId = await queue();
    const held = holdNextSend();
    const first = sender.sendDue();
    await held.started;

    await sender.sendDue();
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sending,
    });

    held.answer.resolve(mailWith(EmailStatus.Sent));
    await first;
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sent,
    });
    expect(sendStaff).toHaveBeenCalledTimes(1);
  });

  it("marks a recipient uncertain once it has been sending for 15 minutes", async () => {
    const [stale, fresh] = [await queue(), await queue()];
    await recipientRepo.update(
      { batchId: stale },
      {
        status: WaitlistEmailRecipientStatus.Sending,
        attemptedAt: subMinutes(new Date(), 16),
      },
    );
    await recipientRepo.update(
      { batchId: fresh },
      {
        status: WaitlistEmailRecipientStatus.Sending,
        attemptedAt: subMinutes(new Date(), 14),
      },
    );

    await sender.sendDue();

    expect(await recipientOf(stale)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Uncertain,
      error: "No answer was recorded within 15 minutes of sending",
    });
    expect(await recipientOf(fresh)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sending,
    });
    expect(sendStaff).not.toHaveBeenCalled();
  });

  it("records a late answer over the uncertain label it earned", async () => {
    const batchId = await queue();
    const held = holdNextSend();
    const first = sender.sendDue();
    await held.started;
    await recipientRepo.update(
      { batchId },
      { attemptedAt: subMinutes(new Date(), 16) },
    );
    await sender.sendDue();
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Uncertain,
    });

    held.answer.resolve(mailWith(EmailStatus.Sent));
    await first;

    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sent,
      error: null,
    });
  });

  const retryWhileSending = async ({ mobilize = false } = {}) => {
    const batchId = await queue({ mobilize });
    const held = holdNextSend();
    const first = sender.sendDue();
    await held.started;
    await recipientRepo.update(
      { batchId },
      { attemptedAt: subMinutes(new Date(), 16) },
    );
    await sender.sendDue();
    await asAdmin(
      request(ctx.app.getHttpServer()).post(
        `/waitlist/admin/emails/${batchId}/retry`,
      ),
    )
      .send({ includeUncertain: true })
      .expect(200);
    const timeOut = async () => {
      held.answer.reject(
        Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" }),
      );
      await first;
    };
    return { batchId, held, first, timeOut };
  };

  it("drops a late answer once a retry has been sent again", async () => {
    const { batchId, timeOut } = await retryWhileSending();
    await sender.sendDue();
    await timeOut();

    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sent,
      error: null,
    });
    expect(sendStaff).toHaveBeenCalledTimes(2);
  });

  const mobilizedAt = async (batchId: number) =>
    (
      await entryRepo.findOneByOrFail({
        id: (await recipientOf(batchId)).entryId,
      })
    ).mobilizedAt;

  it("drops a late Sent answer to a retry still waiting to be sent, and sends it again", async () => {
    const { batchId, held, first } = await retryWhileSending({
      mobilize: true,
    });

    held.answer.resolve(mailWith(EmailStatus.Sent));
    await first;

    expect(sendStaff).toHaveBeenCalledTimes(2);
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sent,
    });
    expect(await mobilizedAt(batchId)).not.toBeNull();
  });

  it("drops a late Sent answer over a newer attempt's failure", async () => {
    const { batchId, held, first } = await retryWhileSending({
      mobilize: true,
    });
    sendStaff.mockResolvedValue(mailWith(EmailStatus.Failed));
    await sender.sendDue();

    held.answer.resolve(mailWith(EmailStatus.Sent));
    await first;

    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Failed,
    });
    expect(await mobilizedAt(batchId)).toBeNull();
  });

  it("drops a late Sent answer while a newer attempt is sending", async () => {
    const { batchId, held, first } = await retryWhileSending({
      mobilize: true,
    });
    const resend = holdNextSend();
    const second = sender.sendDue();
    await resend.started;

    held.answer.resolve(mailWith(EmailStatus.Sent));
    await first;
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sending,
    });
    expect(await mobilizedAt(batchId)).toBeNull();

    resend.answer.resolve(mailWith(EmailStatus.Failed));
    await second;
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Failed,
    });
  });

  it("drops a late answer to a retry still waiting to be sent", async () => {
    const { batchId, timeOut } = await retryWhileSending();
    await timeOut();
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Pending,
    });

    await sender.sendDue();
    expect(await recipientOf(batchId)).toMatchObject({
      status: WaitlistEmailRecipientStatus.Sent,
    });
  });
});
