import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { Community } from "../src/community/entities/community.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist email admin (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let campaignRepo: Repository<Campaign>;
  let inviteRepo: Repository<OnetimeInvite>;

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

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
  }, 50000);

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
});
