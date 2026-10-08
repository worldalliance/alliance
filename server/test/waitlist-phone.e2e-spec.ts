import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { MailService } from "../src/mail/mail.service";
import {
  WaitlistContactMethod,
  WaitlistEntrySort,
} from "../src/waitlist/dto/waitlist-entry-admin.dto";
import { WaitlistCohort } from "../src/waitlist/entities/waitlist-cohort.entity";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "../src/waitlist/entities/waitlist-email-recipient.entity";
import {
  WaitlistEntryAction,
  WaitlistEntryActionKind,
} from "../src/waitlist/entities/waitlist-entry-action.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistEmailSkipReason } from "../src/waitlist/waitlist-email-audience";
import { WaitlistEmailSender } from "../src/waitlist/waitlist-email-sender.service";
import { WaitlistMailService } from "../src/waitlist/waitlist-mail.service";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist phone contact (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let sendShareLink: jest.SpyInstance;
  let sendStaff: jest.SpyInstance;
  let run: jest.SpyInstance;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  let nextPhone = 0;
  const uniquePhone = () => `+1415555${String(nextPhone++).padStart(4, "0")}`;

  const nationalSpelling = (phone: string) =>
    `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;

  const submit = (
    fields: Record<string, unknown>,
    agent: request.Agent | ReturnType<typeof request> = request(server()),
  ) =>
    agent.post("/waitlist/entries").send({
      name: "Phone Person",
      reason: "I want to help",
      committed: true,
      ...fields,
    });

  const saveEntry = (fields: Partial<WaitlistEntry> = {}) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: null,
        phoneNumber: uniquePhone(),
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: "I want to help",
        ...fields,
      }),
    );

  const search = (filter: Record<string, unknown>) =>
    asAdmin(request(server()).post("/waitlist/admin/entries/search")).send({
      filter,
      sort: WaitlistEntrySort.JoinedAsc,
      offset: 0,
      limit: 200,
    });

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    sendShareLink = jest.spyOn(
      ctx.app.get(WaitlistMailService),
      "sendShareLink",
    );
    sendStaff = jest.spyOn(ctx.app.get(MailService), "sendWaitlistStaffEmail");
    run = jest.spyOn(ctx.app.get(WaitlistEmailSender), "run");
  }, 50000);

  beforeEach(() => {
    process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = "1000";
    sendShareLink.mockClear();
    sendStaff.mockClear();
  });

  afterAll(async () => {
    delete process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
    await ctx.app.close();
  });

  describe("signup", () => {
    it("stores a phone entry without optional fields, remembers it in the browser, and mails nothing", async () => {
      const phoneNumber = uniquePhone();
      const browser = request.agent(server());
      const res = await submit(
        { phoneNumber, reason: undefined, committed: undefined },
        browser,
      ).expect(200);

      const entry = await entryRepo.findOneByOrFail({ phoneNumber });
      expect(entry.email).toBeNull();
      expect(entry.reason).toBeNull();
      expect(entry.committedAt).toBeNull();
      expect(res.body.shareCode).toBe(entry.code);
      expect(sendShareLink).not.toHaveBeenCalled();
      const remembered = await browser.get("/waitlist/browser").expect(200);
      expect(remembered.body.entry).toEqual({
        shareCode: entry.code,
        mobilized: false,
      });
    });

    it.each<[string, Record<string, unknown>]>([
      [
        "both contacts",
        { email: "both@example.com", phoneNumber: "+14155552671" },
      ],
      ["neither contact", {}],
      ["a blank email", { email: "  " }],
      ["a null phone number", { phoneNumber: null }],
      ["a national spelling", { phoneNumber: "(415) 555-2671" }],
      ["an invalid number", { phoneNumber: "+1123" }],
    ])("rejects %s without inserting", async (_label, fields) => {
      const before = await entryRepo.count();
      await submit(fields).expect(400);
      expect(await entryRepo.count()).toBe(before);
      expect(sendShareLink).not.toHaveBeenCalled();
    });

    it("keeps the first entry for a repeated number, unsubscribed, and reveals no code", async () => {
      const phoneNumber = uniquePhone();
      const first = await submit({ name: "First", phoneNumber }).expect(200);
      await entryRepo.update(
        { phoneNumber },
        { unsubscribedAt: new Date("2026-01-01T00:00:00Z") },
      );
      const browser = request.agent(server());

      const again = await submit(
        { name: "Second", phoneNumber, reason: "Different" },
        browser,
      ).expect(200);

      expect(again.body.shareCode).toBeNull();
      expect(again.headers["set-cookie"]).toBeUndefined();
      const entries = await entryRepo.findBy({ phoneNumber });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        code: first.body.shareCode,
        name: "First",
        reason: "I want to help",
        unsubscribedAt: new Date("2026-01-01T00:00:00Z"),
      });
      const state = await browser.get("/waitlist/browser").expect(200);
      expect(state.body).toEqual({ entry: null, inviteCode: null });
    });

    it("records one entry for concurrent submissions of a number", async () => {
      const phoneNumber = uniquePhone();
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => submit({ phoneNumber })),
      );

      expect(responses.map((res) => res.status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      const codes = responses
        .map((res) => res.body.shareCode)
        .filter((code) => code !== null);
      const entries = await entryRepo.findBy({ phoneNumber });
      expect(entries).toHaveLength(1);
      expect(codes).toEqual([entries[0].code]);
    });

    it("keeps an email entry and a phone entry of one person apart", async () => {
      const phoneNumber = uniquePhone();
      const email = `same-${Math.random()}@example.com`;
      await submit({ name: "Same Person", email }).expect(200);
      await submit({ name: "Same Person", phoneNumber }).expect(200);

      const email1 = await entryRepo.findOneByOrFail({ email });
      const phone1 = await entryRepo.findOneByOrFail({ phoneNumber });
      expect(email1.id).not.toBe(phone1.id);
      expect(email1.phoneNumber).toBeNull();
    });
  });

  it("enforces exactly one canonical contact in the database", async () => {
    const insert = (contact: {
      email: string | null;
      phoneNumber: string | null;
    }) =>
      entryRepo.insert({
        name: "Constraint",
        reason: "Testing",
        committedAt: new Date(),
        code: `code-${Math.random()}`,
        ...contact,
      });

    await expect(insert({ email: null, phoneNumber: null })).rejects.toThrow(
      /CHK_waitlist_entry_one_contact/,
    );
    await expect(
      insert({ email: "both-db@example.com", phoneNumber: uniquePhone() }),
    ).rejects.toThrow(/CHK_waitlist_entry_one_contact/);
    await expect(
      insert({ email: null, phoneNumber: "415-555-2671" }),
    ).rejects.toThrow(/CHK_waitlist_entry_phone_e164/);
  });

  describe("admin", () => {
    it("shows the contact, and finds a number however it is punctuated", async () => {
      const phone = await saveEntry({ name: "Searchable Phone" });
      const email = await saveEntry({
        name: "Searchable Email",
        phoneNumber: null,
        email: `searchable-${Math.random()}@example.com`,
      });

      const res = await search({
        search: nationalSpelling(phone.phoneNumber ?? ""),
      }).expect(200);
      expect(res.body.entries).toEqual([
        expect.objectContaining({
          id: phone.id,
          email: null,
          phoneNumber: phone.phoneNumber,
          shareCode: phone.code,
        }),
      ]);
      const byEmail = await search({ search: email.email }).expect(200);
      expect(byEmail.body.entries).toEqual([
        expect.objectContaining({ id: email.id, phoneNumber: null }),
      ]);
    });

    it("finds a number by its start typed with a trunk 0", async () => {
      const uk = await saveEntry({ phoneNumber: "+442079460959" });
      const res = await search({ search: "020 7946" }).expect(200);
      expect(res.body.entries.map((e: { id: number }) => e.id)).toContain(
        uk.id,
      );
    });

    it("finds a number by a tail that starts with zeros", async () => {
      const phone = await saveEntry({ phoneNumber: "+12025550000" });
      const res = await search({ search: "0000" }).expect(200);
      expect(res.body.entries.map((e: { id: number }) => e.id)).toContain(
        phone.id,
      );
    });

    it("matches no number from free text that contains its digits", async () => {
      const phone = await saveEntry({ name: "Gated Phone" });
      const res = await search({
        search: `Room ${(phone.phoneNumber ?? "").slice(2, 5)}`,
      }).expect(200);
      expect(res.body.entries).toEqual([]);
    });

    it("finds a non-US number typed with its trunk or international prefix", async () => {
      const uk = await saveEntry({ phoneNumber: "+442079460958" });
      for (const typed of ["020 7946 0958", "0044 20 7946 0958"]) {
        const res = await search({ search: typed }).expect(200);
        expect(res.body.entries).toEqual([
          expect.objectContaining({ id: uk.id }),
        ]);
      }
    });

    it("filters by contact method alike in rows, ids, metrics, and cohorts", async () => {
      const organization = await ctx.dataSource.getRepository(Campaign).save({
        name: "Contact Org",
        code: `org-${Math.random()}`,
        kind: CampaignKind.Organization,
      });
      const phone = await saveEntry({ organizationId: organization.id });
      const email = await saveEntry({
        organizationId: organization.id,
        phoneNumber: null,
        email: `filtered-${Math.random()}@example.com`,
      });
      const ids = async (filter: Record<string, unknown>) =>
        (
          await asAdmin(
            request(server()).post("/waitlist/admin/entries/ids"),
          ).send({ filter })
        ).body.ids;
      const base = { organizationIds: [organization.id] };

      const phoneOnly = {
        ...base,
        contactMethod: WaitlistContactMethod.Phone,
      };
      const rows = await search(phoneOnly).expect(200);
      expect(rows.body.entries.map((e: { id: number }) => e.id)).toEqual([
        phone.id,
      ]);
      expect(rows.body.total).toBe(1);
      expect(await ids(phoneOnly)).toEqual([phone.id]);
      expect(
        await ids({ ...base, contactMethod: WaitlistContactMethod.Email }),
      ).toEqual([email.id]);
      expect(await ids(base)).toEqual(
        [phone.id, email.id].sort((a, b) => a - b),
      );
      const metrics = await asAdmin(
        request(server()).post("/waitlist/admin/entries/metrics"),
      )
        .send({ filter: phoneOnly })
        .expect(200);
      expect(metrics.body.status.entries).toBe(1);
      await search({ contactMethod: "fax" }).expect(400);

      const cohort = await asAdmin(
        request(server()).post("/waitlist/admin/cohorts"),
      )
        .send({ name: `Phones ${Math.random()}`, filter: phoneOnly })
        .expect(201);
      expect(cohort.body.filter.contactMethod).toBe(
        WaitlistContactMethod.Phone,
      );
      const legacy = await ctx.dataSource
        .getRepository(WaitlistCohort)
        .save({ name: `Legacy ${Math.random()}`, filter: base });
      const cohorts = await asAdmin(
        request(server()).get("/waitlist/admin/cohorts"),
      ).expect(200);
      expect(
        cohorts.body.find((c: { id: number }) => c.id === legacy.id).filter,
      ).toEqual(base);
    });

    it("marks an entry unsubscribed once, recording who, and signup leaves it", async () => {
      const entry = await saveEntry();
      const unsubscribe = () =>
        asAdmin(
          request(server()).post("/waitlist/admin/entries/unsubscribe"),
        ).send({ entryIds: [entry.id] });

      expect((await unsubscribe().expect(200)).body.changed).toBe(1);
      expect((await unsubscribe().expect(200)).body.changed).toBe(0);
      await submit({ phoneNumber: entry.phoneNumber }).expect(200);

      const after = await entryRepo.findOneByOrFail({ id: entry.id });
      expect(after.unsubscribedAt).toBeInstanceOf(Date);
      expect(after.mobilizedAt).toBeNull();
      const actions = await ctx.dataSource
        .getRepository(WaitlistEntryAction)
        .findBy({ entryId: entry.id });
      expect(actions).toEqual([
        expect.objectContaining({
          kind: WaitlistEntryActionKind.MarkUnsubscribed,
          staffUserId: ctx.adminUserId,
        }),
      ]);
      await request(server())
        .post("/waitlist/admin/entries/unsubscribe")
        .send({ entryIds: [entry.id] })
        .expect(401);
    });
  });

  describe("email audiences", () => {
    const preview = (entryIds: number[]) =>
      asAdmin(request(server()).post("/waitlist/admin/emails/preview")).send({
        subject: "Hi #{name}",
        body: "Welcome",
        includeClaimed: false,
        entryIds,
      });

    const send = (entryIds: number[]) =>
      asAdmin(request(server()).post("/waitlist/admin/emails")).send({
        subject: "Hi #{name}",
        body: "Welcome",
        includeClaimed: false,
        mobilize: false,
        requestId: crypto.randomUUID(),
        entryIds,
      });

    it("counts phone entries as skipped before any other reason", async () => {
      const phone = await saveEntry({ unsubscribedAt: new Date() });
      const email = await saveEntry({
        phoneNumber: null,
        email: `audience-${Math.random()}@example.com`,
      });

      const res = await preview([phone.id, email.id]).expect(200);
      expect(res.body).toMatchObject({
        selected: 2,
        noEmail: 1,
        unsubscribed: 0,
        recipientIds: [email.id],
      });
    });

    it("refuses to send to only phone entries, and skips them in a mixed send", async () => {
      const phone = await saveEntry();
      const email = await saveEntry({
        phoneNumber: null,
        email: `mixed-${Math.random()}@example.com`,
      });
      await send([phone.id]).expect(400);

      const batch = await send([phone.id, email.id]).expect(201);
      await Promise.all(run.mock.results.map((result) => result.value));

      const recipients = await ctx.dataSource
        .getRepository(WaitlistEmailRecipient)
        .find({ where: { batchId: batch.body.id }, order: { id: "ASC" } });
      expect(
        recipients.map((r) => [r.entryId, r.status, r.skipReason]),
      ).toEqual([
        [
          phone.id,
          WaitlistEmailRecipientStatus.Skipped,
          WaitlistEmailSkipReason.NoEmail,
        ],
        [email.id, expect.any(String), null],
      ]);
      expect(sendStaff.mock.calls.map(([params]) => params.recipient)).toEqual([
        email.email,
      ]);
      const detail = await asAdmin(
        request(server()).get(`/waitlist/admin/emails/${batch.body.id}`),
      ).expect(200);
      expect(detail.body.recipients[0]).toMatchObject({
        entryId: phone.id,
        email: null,
        phoneNumber: phone.phoneNumber,
      });
    });
  });
});
