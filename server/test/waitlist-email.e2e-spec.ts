import request from "supertest";
import { In, IsNull, Not, type Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { Community } from "../src/community/entities/community.entity";
import { EmailStatus, Mail } from "../src/mail/mail.entity";
import { MailService } from "../src/mail/mail.service";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
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
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist email admin (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let campaignRepo: Repository<Campaign>;
  let inviteRepo: Repository<OnetimeInvite>;
  let recipientRepo: Repository<WaitlistEmailRecipient>;
  let sendStaff: jest.SpyInstance;
  let run: jest.SpyInstance;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const template = (fields: Record<string, unknown> = {}) => ({
    name: `Template ${Math.random()}`,
    subject: "Hi #{name}",
    body: "Join with #{signupLink}",
    ...fields,
  });

  const saveOrganization = async (name: string, withGroup: boolean) =>
    campaignRepo.save(
      campaignRepo.create({
        name,
        code: `org-${Math.random()}`,
        kind: CampaignKind.Organization,
        communityId: withGroup
          ? (
              await ctx.dataSource
                .getRepository(Community)
                .save({ name: `${name} group` })
            ).id
          : null,
      }),
    );

  const saveEntry = (fields: Partial<WaitlistEntry> = {}) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: `person-${Math.random()}@example.com`,
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: "I want to help",
        ...fields,
      }),
    );

  const claimInvite = async (entry: WaitlistEntry) => {
    const invite = await inviteRepo.save(
      inviteRepo.create({
        invitee: entry.name,
        code: `invite-${Math.random()}`,
        status: OnetimeInviteStatus.LINK_USED,
        organizationId: entry.organizationId,
        waitlistEntryId: entry.id,
      }),
    );
    const userRepo = ctx.dataSource.getRepository(User);
    await userRepo.save(
      userRepo.create({
        email: `claimant-${Math.random()}@example.com`,
        password: "password",
        name: "Claimant",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      }),
    );
  };

  const preview = (body: Record<string, unknown>) =>
    asAdmin(request(server()).post("/waitlist/admin/emails/preview")).send({
      subject: "Hi #{name}",
      body: "Welcome",
      includeClaimed: false,
      ...body,
    });

  const mailWith = (status: EmailStatus) =>
    Object.assign(new Mail(), { status });

  /** Waits for the sending runs requests started. */
  const settled = () =>
    Promise.all(run.mock.results.map((result) => result.value));

  const send = async (body: Record<string, unknown>) => {
    const res = await asAdmin(request(server()).post("/waitlist/admin/emails"))
      .send({
        subject: "Hi #{name}",
        body: "Welcome",
        includeClaimed: false,
        mobilize: false,
        requestId: crypto.randomUUID(),
        ...body,
      })
      .expect(201);
    await settled();
    return res.body;
  };

  const retry = (batchId: number, body: Record<string, unknown>) =>
    asAdmin(
      request(server()).post(`/waitlist/admin/emails/${batchId}/retry`),
    ).send(body);

  const recipientsOf = (batchId: number) =>
    recipientRepo.find({ where: { batchId }, order: { id: "ASC" } });

  const sentTo = (email: string) =>
    sendStaff.mock.calls.filter(([params]) => params.recipient === email);

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    recipientRepo = ctx.dataSource.getRepository(WaitlistEmailRecipient);
    sendStaff = jest.spyOn(ctx.app.get(MailService), "sendWaitlistStaffEmail");
    run = jest.spyOn(ctx.app.get(WaitlistEmailSender), "run");
  }, 50000);

  beforeEach(() => {
    sendStaff.mockReset();
    sendStaff.mockResolvedValue(mailWith(EmailStatus.Sent));
    run.mockClear();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("templates", () => {
    it("rejects non-admins", async () => {
      await request(server())
        .get("/waitlist/admin/email-templates")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it("creates, lists, updates, and deletes a template", async () => {
      const created = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ name: "  Followup  " }))
        .expect(201);
      expect(created.body).toMatchObject({
        name: "Followup",
        subject: "Hi #{name}",
        body: "Join with #{signupLink}",
      });

      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      )
        .send(template({ name: "Followup", subject: "Hello #{name}" }))
        .expect(200);
      const listed = await asAdmin(
        request(server()).get("/waitlist/admin/email-templates"),
      ).expect(200);
      expect(listed.body).toContainEqual(
        expect.objectContaining({
          id: created.body.id,
          subject: "Hello #{name}",
        }),
      );

      await asAdmin(
        request(server()).delete(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      ).expect(204);
      await asAdmin(
        request(server()).delete(
          `/waitlist/admin/email-templates/${created.body.id}`,
        ),
      ).expect(404);
    });

    it("refuses a name another template has, in any case", async () => {
      const name = `Taken ${Math.random()}`;
      await asAdmin(request(server()).post("/waitlist/admin/email-templates"))
        .send(template({ name }))
        .expect(201);
      await asAdmin(request(server()).post("/waitlist/admin/email-templates"))
        .send(template({ name: name.toUpperCase() }))
        .expect(409);

      const other = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template())
        .expect(201);
      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${other.body.id}`,
        ),
      )
        .send(template({ name: name.toLowerCase() }))
        .expect(409);
      await asAdmin(
        request(server()).put(
          `/waitlist/admin/email-templates/${other.body.id}`,
        ),
      )
        .send(template({ name: other.body.name.toUpperCase() }))
        .expect(200);
    });

    it("answers 404 for a template that doesn't exist", async () => {
      await asAdmin(
        request(server()).put("/waitlist/admin/email-templates/999999999"),
      )
        .send(template())
        .expect(404);
    });

    it("refuses a blank body", async () => {
      const res = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ body: "  \n " }))
        .expect(400);
      expect(res.body.message).toEqual(["body should not be blank"]);
    });

    it("refuses unknown placeholders in the subject or body", async () => {
      const res = await asAdmin(
        request(server()).post("/waitlist/admin/email-templates"),
      )
        .send(template({ subject: "Hi #{firstname}", body: "#{link|links}" }))
        .expect(400);
      expect(res.body.message).toEqual([
        "subject has unknown placeholders: #{firstname}",
        "body has unknown placeholders: #{link|links}",
      ]);
    });
  });

  describe("preview", () => {
    it("counts who a send reaches and skips", async () => {
      const grouped = await saveOrganization("Grouped Org", true);
      const ungrouped = await saveOrganization("Ungrouped Org", false);
      const waiting = await saveEntry({ organizationId: grouped.id });
      const mobilized = await saveEntry({
        organizationId: ungrouped.id,
        mobilizedAt: new Date(),
      });
      const unaffiliated = await saveEntry();
      const unsubscribed = await saveEntry({ unsubscribedAt: new Date() });
      const claimed = await saveEntry({ organizationId: grouped.id });
      await claimInvite(claimed);
      const entryIds = [
        waiting.id,
        mobilized.id,
        unaffiliated.id,
        unsubscribed.id,
        claimed.id,
        999_999_999,
      ];

      const res = await preview({ entryIds }).expect(200);
      expect(res.body).toMatchObject({
        selected: 5,
        unsubscribed: 1,
        claimed: 1,
        recipientIds: [waiting.id, mobilized.id, unaffiliated.id],
        waiting: 2,
        withoutOrganization: 1,
        withoutGroup: 1,
      });

      const included = await preview({ entryIds, includeClaimed: true }).expect(
        200,
      );
      expect(included.body.recipientIds).toEqual([
        waiting.id,
        mobilized.id,
        unaffiliated.id,
        claimed.id,
      ]);
    });

    it("renders the requested recipient without issuing an invite", async () => {
      const organization = await saveOrganization("Sample Org", false);
      const first = await saveEntry({ organizationId: organization.id });
      const second = await saveEntry({
        name: "<b>Second</b>",
        organizationId: organization.id,
      });

      const res = await preview({
        entryIds: [first.id, second.id],
        sampleEntryId: second.id,
        subject: "Hi #{name} of #{organizationName}",
        body: "[Sign up](#{signupLink}) or share #{personalShareLink}",
      }).expect(200);

      const { sample } = res.body;
      expect(sample).toMatchObject({
        entryId: second.id,
        subject: "Hi <b>Second</b> of Sample Org",
        missing: [],
      });
      expect(sample.html).toContain(
        "<title>Hi &lt;b&gt;Second&lt;/b&gt; of Sample Org</title>",
      );
      expect(sample.html).toContain("/signup?ref=SIGNUP-CODE");
      expect(sample.html).toContain(`?ref=${second.code}`);
      expect(sample.html).toContain(
        "/waitlist/unsubscribe?token=00000000-0000-0000-0000-000000000000",
      );
      expect(sample.html).not.toContain(second.unsubscribeToken);
      expect(await inviteRepo.countBy({ waitlistEntryId: second.id })).toBe(0);
    });

    it("samples a recipient with an organization when the email names it", async () => {
      const organization = await saveOrganization("Named Org", false);
      const unaffiliated = await saveEntry();
      const affiliated = await saveEntry({ organizationId: organization.id });
      const entryIds = [unaffiliated.id, affiliated.id];
      const body = "From #{organizationName}";

      const res = await preview({ entryIds, body }).expect(200);
      expect(res.body.sample.entryId).toBe(affiliated.id);

      const missing = await preview({
        entryIds,
        body,
        sampleEntryId: unaffiliated.id,
      }).expect(200);
      expect(missing.body.sample).toMatchObject({
        entryId: unaffiliated.id,
        subject: null,
        html: null,
        missing: ["organizationName"],
      });
    });

    it("has no sample when every selected entry is skipped", async () => {
      const unsubscribed = await saveEntry({ unsubscribedAt: new Date() });
      const res = await preview({ entryIds: [unsubscribed.id] }).expect(200);
      expect(res.body.sample).toBeNull();
    });
  });

  describe("sending", () => {
    it("emails each recipient an invite to their organization's group and mobilizes the waiting", async () => {
      const organization = await saveOrganization("Sending Org", true);
      const waiting = await saveEntry({
        name: "Wai Ting",
        organizationId: organization.id,
      });
      const mobilizedAt = new Date("2026-01-01T00:00:00Z");
      const mobilized = await saveEntry({ mobilizedAt });

      run.mockImplementationOnce(async () => {});
      const batch = await send({
        entryIds: [waiting.id, mobilized.id],
        subject: "Join, #{name}",
        body: "[Sign up](#{signupLink})",
        mobilize: true,
      });

      expect(batch.counts).toMatchObject({ pending: 2, sent: 0 });
      await ctx.app.get(WaitlistEmailSender).run();
      const recipients = await recipientsOf(batch.id);
      expect(recipients.map((r) => r.status)).toEqual([
        WaitlistEmailRecipientStatus.Sent,
        WaitlistEmailRecipientStatus.Sent,
      ]);
      const [invite] = await inviteRepo.find({
        where: { waitlistEntryId: waiting.id },
        relations: { community: true },
      });
      expect(invite).toMatchObject({
        organizationId: organization.id,
        community: { id: organization.communityId },
        status: OnetimeInviteStatus.LINK_UNUSED,
      });
      expect(recipients[0]).toMatchObject({
        inviteId: invite.id,
        renderedSubject: "Join, Wai Ting",
        acceptedAt: expect.any(Date),
      });
      expect(recipients[0].renderedHtml).toContain(
        `/signup?ref=${invite.code}`,
      );
      expect(recipients[0].renderedHtml).toContain(waiting.unsubscribeToken);
      expect(sentTo(waiting.email)).toEqual([
        [
          {
            recipient: waiting.email,
            content: expect.objectContaining({ subject: "Join, Wai Ting" }),
          },
        ],
      ]);

      expect(
        (await entryRepo.findOneByOrFail({ id: waiting.id })).mobilizedAt,
      ).not.toBeNull();
      expect(
        (await entryRepo.findOneByOrFail({ id: mobilized.id })).mobilizedAt,
      ).toEqual(mobilizedAt);
      expect(
        await ctx.dataSource.getRepository(WaitlistEntryAction).findBy({
          entryId: waiting.id,
        }),
      ).toEqual([
        expect.objectContaining({
          kind: WaitlistEntryActionKind.EmailMobilize,
          staffUserId: ctx.adminUserId,
        }),
      ]);
    });

    it("reuses an entry's unused invite and issues another once it's revoked", async () => {
      const entry = await saveEntry();
      const content = { entryIds: [entry.id], body: "#{signupLink}" };

      await send(content);
      await send(content);
      const [first] = await inviteRepo.findBy({ waitlistEntryId: entry.id });
      expect(
        sentTo(entry.email).map(([params]) => params.content.bodyHtml),
      ).toEqual([
        expect.stringContaining(first.code),
        expect.stringContaining(first.code),
      ]);

      await inviteRepo.update(first.id, { deletedAt: new Date() });
      await send(content);
      expect(await inviteRepo.countBy({ waitlistEntryId: entry.id })).toBe(2);
    });

    it("keeps a reused invite's group after its organization's changes", async () => {
      const organization = await saveOrganization("Later Group Org", false);
      const entry = await saveEntry({ organizationId: organization.id });
      const content = { entryIds: [entry.id], body: "#{signupLink}" };
      await send(content);
      const group = await ctx.dataSource
        .getRepository(Community)
        .save({ name: "Later group" });
      await campaignRepo.update(organization.id, { communityId: group.id });

      await send(content);
      const invites = await inviteRepo.find({
        where: { waitlistEntryId: entry.id },
        relations: { community: true },
      });
      expect(invites.map((invite) => invite.community)).toEqual([null]);
    });

    it("issues no invite for an email without a signup link", async () => {
      const entry = await saveEntry();
      await send({ entryIds: [entry.id], mobilize: true });
      expect(await inviteRepo.countBy({ waitlistEntryId: entry.id })).toBe(0);
    });

    it("creates one batch per request id and sends it once", async () => {
      const entry = await saveEntry();
      const requestId = crypto.randomUUID();

      const first = await send({ entryIds: [entry.id], requestId });
      const other = await saveEntry();
      const repeat = await send({ entryIds: [entry.id, other.id], requestId });

      expect(repeat.id).toBe(first.id);
      expect(await recipientsOf(first.id)).toHaveLength(1);
      expect(sentTo(entry.email)).toHaveLength(1);
      expect(sentTo(other.email)).toHaveLength(0);
    });

    it("rechecks suppression when sending, and skips claimed invites unless included", async () => {
      const organization = await saveOrganization("Claimed Org", false);
      const unsubscribed = await saveEntry();
      const claimed = await saveEntry({ organizationId: organization.id });
      await claimInvite(claimed);
      run.mockImplementationOnce(async () => {});

      const batch = await send({
        entryIds: [unsubscribed.id, claimed.id],
        body: "#{signupLink}",
      });
      await entryRepo.update(unsubscribed.id, { unsubscribedAt: new Date() });
      await ctx.app.get(WaitlistEmailSender).run();

      expect(
        (await recipientsOf(batch.id)).map((r) => [r.status, r.skipReason]),
      ).toEqual([
        [
          WaitlistEmailRecipientStatus.Skipped,
          WaitlistEmailSkipReason.Unsubscribed,
        ],
        [
          WaitlistEmailRecipientStatus.Skipped,
          WaitlistEmailSkipReason.InviteClaimed,
        ],
      ]);
      expect(sendStaff).not.toHaveBeenCalled();

      await send({
        entryIds: [claimed.id],
        body: "#{signupLink}",
        includeClaimed: true,
      });
      expect(sentTo(claimed.email)).toHaveLength(1);
      expect(await inviteRepo.countBy({ waitlistEntryId: claimed.id })).toBe(2);
    });

    it("refuses #{organizationName} when a recipient has no organization", async () => {
      const entry = await saveEntry();
      const res = await asAdmin(
        request(server()).post("/waitlist/admin/emails"),
      )
        .send({
          subject: "From #{organizationName}",
          body: "Hi",
          entryIds: [entry.id],
          includeClaimed: false,
          mobilize: false,
          requestId: crypto.randomUUID(),
        })
        .expect(400);
      expect(res.body.message).toBe(
        "1 recipient has no organization for #{organizationName}",
      );
      expect(await recipientRepo.countBy({ entryId: entry.id })).toBe(0);
    });

    it("mobilizes only accepted recipients, and retries uncertain ones only when asked", async () => {
      const refused = await saveEntry();
      const off = await saveEntry();
      const timedOut = await saveEntry();
      const later = await saveEntry();
      const entryIds = [refused.id, off.id, timedOut.id, later.id];
      sendStaff.mockImplementation(async ({ recipient }) => {
        if (recipient === refused.email) {
          throw Object.assign(new Error("550 mailbox unavailable"), {
            responseCode: 550,
            command: "RCPT TO",
          });
        }
        if (recipient === timedOut.email) {
          throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
        }
        return mailWith(EmailStatus.Pending);
      });
      const statuses = async () =>
        (await recipientsOf(batch.id)).map((r) => [r.status, r.error]);

      const batch = await send({ entryIds, mobilize: true });
      expect(await statuses()).toEqual([
        [WaitlistEmailRecipientStatus.Failed, "550 mailbox unavailable"],
        [
          WaitlistEmailRecipientStatus.Failed,
          "Mail delivery is off on this server",
        ],
        [WaitlistEmailRecipientStatus.Uncertain, "Timeout"],
        [WaitlistEmailRecipientStatus.Pending, null],
      ]);

      await ctx.app.get(WaitlistEmailSender).run();
      expect((await statuses()).slice(2)).toEqual([
        [WaitlistEmailRecipientStatus.Uncertain, "Timeout"],
        [
          WaitlistEmailRecipientStatus.Failed,
          "Mail delivery is off on this server",
        ],
      ]);
      expect(
        await entryRepo.countBy({
          id: In(entryIds),
          mobilizedAt: Not(IsNull()),
        }),
      ).toBe(0);

      sendStaff.mockReset();
      sendStaff.mockResolvedValue(mailWith(EmailStatus.Sent));
      const resend = (includeUncertain: boolean) =>
        retry(batch.id, { includeUncertain }).expect(200).then(settled);

      await resend(false);
      expect(sentTo(timedOut.email)).toHaveLength(0);
      expect(sentTo(refused.email)).toHaveLength(1);
      await resend(true);
      expect(sentTo(timedOut.email)).toHaveLength(1);
      await resend(true);
      expect(sendStaff).toHaveBeenCalledTimes(4);
      expect(
        await entryRepo.countBy({
          id: In(entryIds),
          mobilizedAt: Not(IsNull()),
        }),
      ).toBe(4);
    });

    it("clears a retried recipient's error", async () => {
      const entry = await saveEntry();
      sendStaff.mockRejectedValueOnce(
        Object.assign(new Error("550 no"), {
          responseCode: 550,
          command: "RCPT TO",
        }),
      );
      const batch = await send({ entryIds: [entry.id] });
      run.mockImplementationOnce(async () => {});

      await retry(batch.id, { includeUncertain: false })
        .expect(200)
        .then(settled);

      expect(await recipientsOf(batch.id)).toEqual([
        expect.objectContaining({
          status: WaitlistEmailRecipientStatus.Pending,
          error: null,
        }),
      ]);
      await ctx.app.get(WaitlistEmailSender).run();
    });

    it("leaves recipients being sent or skipped alone when retrying", async () => {
      const [sending, skipped] = await Promise.all([saveEntry(), saveEntry()]);
      run.mockImplementationOnce(async () => {});
      const batch = await send({ entryIds: [sending.id, skipped.id] });
      const [first, second] = await recipientsOf(batch.id);
      await recipientRepo.update(first.id, {
        status: WaitlistEmailRecipientStatus.Sending,
      });
      await recipientRepo.update(second.id, {
        status: WaitlistEmailRecipientStatus.Skipped,
        skipReason: WaitlistEmailSkipReason.Unsubscribed,
      });
      run.mockImplementationOnce(async () => {});

      await retry(batch.id, { includeUncertain: true }).expect(200);
      expect((await recipientsOf(batch.id)).map((r) => r.status)).toEqual([
        WaitlistEmailRecipientStatus.Sending,
        WaitlistEmailRecipientStatus.Skipped,
      ]);
      await ctx.app.get(WaitlistEmailSender).run();
    });

    it("refuses a retry without includeUncertain, or of an unknown email", async () => {
      const entry = await saveEntry();
      const batch = await send({ entryIds: [entry.id] });
      await retry(batch.id, {}).expect(400);
      await retry(999999, { includeUncertain: false }).expect(404);
    });

    it("sends nobody while the mail server can't be reached", async () => {
      const entry = await saveEntry();
      const verify = jest
        .spyOn(ctx.app.get(MailService), "verifyTransport")
        .mockResolvedValue(false);
      try {
        const batch = await send({ entryIds: [entry.id] });
        expect(await recipientsOf(batch.id)).toEqual([
          expect.objectContaining({
            status: WaitlistEmailRecipientStatus.Pending,
          }),
        ]);
        expect(sendStaff).not.toHaveBeenCalled();
      } finally {
        verify.mockRestore();
      }
      await ctx.app.get(WaitlistEmailSender).run();
      expect(sentTo(entry.email)).toHaveLength(1);
    });

    it("keeps recipients pending while the mail server defers a send", async () => {
      const deferred = await saveEntry();
      const after = await saveEntry();
      sendStaff.mockRejectedValueOnce(
        Object.assign(new Error("421 try again later"), { responseCode: 421 }),
      );
      const batch = await send({ entryIds: [deferred.id, after.id] });
      expect(
        (await recipientsOf(batch.id)).map((r) => [r.status, r.error]),
      ).toEqual([
        [WaitlistEmailRecipientStatus.Pending, "421 try again later"],
        [WaitlistEmailRecipientStatus.Pending, null],
      ]);
      expect(sendStaff).toHaveBeenCalledTimes(1);

      await ctx.app.get(WaitlistEmailSender).run();
      expect(
        (await recipientsOf(batch.id)).map((r) => [r.status, r.error]),
      ).toEqual([
        [WaitlistEmailRecipientStatus.Sent, null],
        [WaitlistEmailRecipientStatus.Sent, null],
      ]);
    });

    it("returns the batch for a repeated request id before checking its content", async () => {
      const organization = await saveOrganization("Repeat Org", false);
      const entry = await saveEntry({ organizationId: organization.id });
      const requestId = crypto.randomUUID();
      const first = await send({
        entryIds: [entry.id],
        body: "From #{organizationName}",
        requestId,
      });
      const unaffiliated = await saveEntry();

      const repeat = await send({
        entryIds: [entry.id, unaffiliated.id],
        body: "From #{organizationName}",
        requestId,
      });
      expect(repeat.id).toBe(first.id);
    });

    it("fails a recipient it can't prepare and leaves the rest for the next run", async () => {
      const broken = await saveEntry();
      const fine = await saveEntry();
      const renderStaff = jest
        .spyOn(ctx.app.get(MailService), "renderWaitlistStaffEmail")
        .mockRejectedValueOnce(new Error("template broke"));
      try {
        const batch = await send({ entryIds: [broken.id, fine.id] });
        expect(
          (await recipientsOf(batch.id)).map((r) => [r.status, r.error]),
        ).toEqual([
          [WaitlistEmailRecipientStatus.Failed, "template broke"],
          [WaitlistEmailRecipientStatus.Pending, null],
        ]);
        await ctx.app.get(WaitlistEmailSender).run();
        expect((await recipientsOf(batch.id)).map((r) => r.status)).toEqual([
          WaitlistEmailRecipientStatus.Failed,
          WaitlistEmailRecipientStatus.Sent,
        ]);
      } finally {
        renderStaff.mockRestore();
      }
    });

    it("marks a recipient left sending by an interrupted run uncertain", async () => {
      const entry = await saveEntry();
      run.mockImplementationOnce(async () => {});
      const batch = await send({ entryIds: [entry.id] });
      await recipientRepo.update(
        { batchId: batch.id },
        { status: WaitlistEmailRecipientStatus.Sending },
      );

      await ctx.app.get(WaitlistEmailSender).run();

      expect(await recipientsOf(batch.id)).toEqual([
        expect.objectContaining({
          status: WaitlistEmailRecipientStatus.Uncertain,
        }),
      ]);
      expect(sendStaff).not.toHaveBeenCalled();
    });

    it("lists emails with their counts and shows one's recipients", async () => {
      const entry = await saveEntry({ name: "Listed Person" });
      const unsubscribed = await saveEntry({ unsubscribedAt: new Date() });
      const older = await send({ entryIds: [entry.id] });
      const batch = await send({
        entryIds: [entry.id, unsubscribed.id],
        subject: "Listed subject",
      });

      const listed = await asAdmin(
        request(server()).get("/waitlist/admin/emails"),
      ).expect(200);
      expect(
        listed.body
          .slice(0, 2)
          .map((listedBatch: { id: number }) => listedBatch.id),
      ).toEqual([batch.id, older.id]);
      expect(listed.body[0]).toMatchObject({
        id: batch.id,
        subject: "Listed subject",
        body: "Welcome",
        mobilize: false,
        staffName: expect.any(String),
        counts: { sent: 1, skipped: 1, pending: 0, failed: 0, uncertain: 0 },
      });

      const detail = await asAdmin(
        request(server()).get(`/waitlist/admin/emails/${batch.id}`),
      ).expect(200);
      expect(detail.body.recipients).toEqual([
        expect.objectContaining({
          entryId: entry.id,
          name: "Listed Person",
          email: entry.email,
          status: WaitlistEmailRecipientStatus.Sent,
          acceptedAt: expect.any(String),
          error: null,
        }),
        expect.objectContaining({
          entryId: unsubscribed.id,
          status: WaitlistEmailRecipientStatus.Skipped,
          skipReason: WaitlistEmailSkipReason.Unsubscribed,
          acceptedAt: null,
        }),
      ]);
    });

    it("answers 404 for an email that doesn't exist", async () => {
      await asAdmin(
        request(server()).get("/waitlist/admin/emails/999999"),
      ).expect(404);
    });
  });
});
