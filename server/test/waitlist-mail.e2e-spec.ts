import request from "supertest";
import type { Repository } from "typeorm";
import { EventLog, EventType } from "../src/eventlog/event-log.entity";
import { EmailType } from "../src/mail/mail.entity";
import { MailService } from "../src/mail/mail.service";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistMailAllowance } from "../src/waitlist/entities/waitlist-mail-allowance.entity";
import { WaitlistMailService } from "../src/waitlist/waitlist-mail.service";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist mail (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let allowanceRepo: Repository<WaitlistMailAllowance>;
  let eventRepo: Repository<EventLog>;
  let sendLink: jest.SpyInstance;
  let sendShareLink: jest.SpyInstance;

  const uniqueEmail = () => `mail-${Math.random()}@example.com`;

  const submit = (email: string) =>
    request(ctx.app.getHttpServer()).post("/waitlist/entries").send({
      name: "Test Person",
      email,
      reason: "I want to help",
      committed: true,
    });

  const requestLink = (email: string) =>
    request(ctx.app.getHttpServer())
      .post("/waitlist/link-requests")
      .send({ email });

  /** An entry that got no confirmation, so its address has its allowance. */
  const enter = (email: string) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email,
        reason: "I want to help",
        committedAt: new Date(),
        code: `code-${Math.random()}`,
      }),
    );

  /** Waits for the background sends an entry or link request starts. */
  const settled = () =>
    Promise.all(sendShareLink.mock.results.map((result) => result.value));

  const sentTo = (email: string) =>
    sendLink.mock.calls.filter(([params]) => params.recipient === email);

  const join = async (email: string) => {
    const res = await submit(email).expect(200);
    await settled();
    return res.body.shareCode as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    allowanceRepo = ctx.dataSource.getRepository(WaitlistMailAllowance);
    eventRepo = ctx.dataSource.getRepository(EventLog);
    sendLink = jest.spyOn(ctx.app.get(MailService), "sendWaitlistLinkEmail");
    sendShareLink = jest.spyOn(
      ctx.app.get(WaitlistMailService),
      "sendShareLink",
    );
  }, 50000);

  beforeEach(() => {
    process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = "1000";
    sendLink.mockClear();
    sendShareLink.mockClear();
  });

  afterAll(async () => {
    delete process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
    await ctx.app.close();
  });

  it("mails a new entry its personal link", async () => {
    const email = uniqueEmail();
    const code = await join(email);

    expect(sentTo(email)).toEqual([
      [
        {
          recipient: email,
          emailType: EmailType.WaitlistConfirmation,
          url: expect.stringContaining(
            `/projects/democratic-grantmaking-26?ref=${code}`,
          ),
        },
      ],
    ]);
  });

  it("mails nothing for a repeated email", async () => {
    const email = uniqueEmail();
    await join(email);
    sendLink.mockClear();

    await submit(email).expect(200);
    await settled();
    expect(sendLink).not.toHaveBeenCalled();
  });

  it("mails a requested link from the stored entry, answering before it sends", async () => {
    const email = uniqueEmail();
    const entry = await enter(email);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    sendLink.mockImplementationOnce(() => held);

    await requestLink(email.toUpperCase()).expect(204);
    release();
    await settled();

    expect(sentTo(email)).toEqual([
      [
        {
          recipient: email,
          emailType: EmailType.WaitlistLink,
          url: expect.stringContaining(`?ref=${entry.code}`),
        },
      ],
    ]);
  });

  it("answers alike for an unknown or unsubscribed address and mails neither", async () => {
    const unsubscribed = uniqueEmail();
    await entryRepo.update(
      { id: (await enter(unsubscribed)).id },
      { unsubscribedAt: new Date() },
    );

    await requestLink(uniqueEmail()).expect(204);
    await requestLink(unsubscribed).expect(204);
    await settled();

    expect(sendShareLink).toHaveBeenCalledTimes(2);
    expect(sendLink).not.toHaveBeenCalled();
  });

  it("mails an address once a day across entry and link requests", async () => {
    const email = uniqueEmail();
    await join(email);

    await requestLink(email).expect(204);
    await requestLink(email).expect(204);
    await settled();
    expect(sentTo(email)).toHaveLength(1);

    await allowanceRepo.update(
      { email },
      { claimedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    );
    await requestLink(email).expect(204);
    await settled();
    expect(sentTo(email)).toHaveLength(2);
  });

  it("mails once for concurrent sends to one address", async () => {
    const email = uniqueEmail();
    await enter(email);

    const service = ctx.app.get(WaitlistMailService);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.sendShareLink({ email, emailType: EmailType.WaitlistLink }),
      ),
    );
    expect(sentTo(email)).toHaveLength(1);
  });

  it("stops at the daily cap and reports reaching it once", async () => {
    const emails = [uniqueEmail(), uniqueEmail(), uniqueEmail()];
    for (const email of emails) {
      await enter(email);
    }
    const sentToday = await allowanceRepo
      .createQueryBuilder()
      .where(`"claimedAt" >= date_trunc('day', now(), 'UTC')`)
      .getCount();
    process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = String(sentToday + 2);

    for (const email of emails) {
      await requestLink(email).expect(204);
    }
    await settled();

    expect(sendLink).toHaveBeenCalledTimes(2);
    expect(sentTo(emails[2])).toHaveLength(0);
    expect(
      await eventRepo.countBy({ event: EventType.WaitlistMailCapReached }),
    ).toBe(1);
  });

  describe("while public mail is off", () => {
    beforeEach(() => {
      delete process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
    });

    it("reports it", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/waitlist/mail-config")
        .expect(200);
      expect(res.body).toEqual({ enabled: false });
    });

    it("still records entries, mailing nothing, and refuses link requests", async () => {
      const email = uniqueEmail();
      await join(email);
      await requestLink(email).expect(503);
      expect(sendLink).not.toHaveBeenCalled();
    });
  });

  it("reports public mail on", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/waitlist/mail-config")
      .expect(200);
    expect(res.body).toEqual({ enabled: true });
  });
});
