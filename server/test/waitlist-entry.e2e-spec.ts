import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { Community } from "../src/community/entities/community.entity";
import {
  CreateWaitlistEntryDto,
  WaitlistReferralCodesDto,
} from "../src/waitlist/dto/waitlist.dto";
import {
  WaitlistEntry,
  WaitlistSpamStatus,
} from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist entry (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let campaignRepo: Repository<Campaign>;
  let linkRepo: Repository<WaitlistLink>;
  let organization: Campaign;
  let link: WaitlistLink;

  type EntryFields = Partial<Omit<CreateWaitlistEntryDto, "committed">> & {
    committed?: boolean | string | null;
  };

  const submit = (fields: EntryFields) =>
    request(ctx.app.getHttpServer())
      .post("/waitlist/entries")
      .send({
        name: "Test Person",
        email: `person-${Math.random()}@example.com`,
        ...fields,
      });

  const referral = (query: WaitlistReferralCodesDto) =>
    request(ctx.app.getHttpServer()).get("/waitlist/referral").query(query);

  const saveOrganization = (fields: Partial<Campaign>) =>
    campaignRepo.save(
      campaignRepo.create({
        name: "Org",
        code: `org-${Math.random()}`,
        kind: CampaignKind.Organization,
        ...fields,
      }),
    );

  const saveLink = (fields: Partial<WaitlistLink>) =>
    linkRepo.save(
      linkRepo.create({
        code: `link-${Math.random()}`,
        organizationId: organization.id,
        channel: "Newsletter",
        ...fields,
      }),
    );

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    linkRepo = ctx.dataSource.getRepository(WaitlistLink);
    organization = await saveOrganization({
      name: "Acme Foundation",
      picture: "acme.webp",
    });
    link = await saveLink({});
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("POST /waitlist/entries", () => {
    it("attributes an entry to the organization link it joined through", async () => {
      const res = await submit({
        email: "linked@example.com",
        linkCode: link.code,
      }).expect(200);

      const entry = await entryRepo.findOneByOrFail({
        email: "linked@example.com",
      });
      expect(res.body.shareCode).toBe(entry.code);
      expect(entry.organizationId).toBe(organization.id);
      expect(entry.sourceLinkId).toBe(link.id);
      expect(entry.referrerId).toBeNull();
      expect(entry.reason).toBeNull();
      expect(entry.committedAt).toBeNull();
    });

    it("carries the referrer's organization and source link to a personal referral", async () => {
      const first = await submit({ linkCode: link.code }).expect(200);
      await submit({
        email: "referred@example.com",
        referrerCode: first.body.shareCode,
      }).expect(200);

      const referrer = await entryRepo.findOneByOrFail({
        code: first.body.shareCode,
      });
      const entry = await entryRepo.findOneByOrFail({
        email: "referred@example.com",
      });
      expect(entry.referrerId).toBe(referrer.id);
      expect(entry.organizationId).toBe(organization.id);
      expect(entry.sourceLinkId).toBe(link.id);
      expect(entry.code).not.toBe(referrer.code);
    });

    it.each([
      {},
      { reason: "", committed: "" },
      { reason: "   ", committed: "   " },
      { reason: null, committed: null },
      { committed: false },
    ])("accepts omitted or blank signup fields %p", async (fields) => {
      const direct = await submit(fields).expect(200);
      const entry = await entryRepo.findOneByOrFail({
        code: direct.body.shareCode,
      });
      expect(entry.reason).toBeNull();
      expect(entry.committedAt).toBeNull();
      expect(entry.organizationId).toBeNull();
      await submit({ referrerCode: direct.body.shareCode, ...fields }).expect(
        200,
      );
    });

    it("preserves an explicitly supplied reason and commitment", async () => {
      const direct = await submit({
        reason: " I want to help ",
        committed: true,
      }).expect(200);
      const entry = await entryRepo.findOneByOrFail({
        code: direct.body.shareCode,
      });
      expect(entry.reason).toBe("I want to help");
      expect(entry.committedAt).toBeInstanceOf(Date);
    });

    it("keeps the first entry for a repeated email and reveals no code", async () => {
      const first = await submit({
        name: "First Name",
        email: "Repeat@Example.com",
        linkCode: link.code,
      }).expect(200);

      const again = await submit({
        name: "Second Name",
        email: " repeat@example.com ",
        reason: "Different",
      }).expect(200);

      expect(again.body.shareCode).toBeNull();
      const entries = await entryRepo.findBy({ email: "repeat@example.com" });
      expect(entries).toHaveLength(1);
      expect(entries[0].code).toBe(first.body.shareCode);
      expect(entries[0].name).toBe("First Name");
      expect(entries[0].organizationId).toBe(organization.id);
      expect(entries[0].reason).toBeNull();
    });

    it("keeps a deleted entry for its email and reveals no code", async () => {
      const first = await submit({
        email: "deleted-repeat@example.com",
        linkCode: link.code,
      }).expect(200);
      await entryRepo.softDelete({ code: first.body.shareCode });

      const again = await submit({
        email: "deleted-repeat@example.com",
        linkCode: link.code,
      }).expect(200);

      expect(again.body.shareCode).toBeNull();
      expect(
        await entryRepo.count({
          where: { email: "deleted-repeat@example.com" },
          withDeleted: true,
        }),
      ).toBe(1);
    });

    it("records one entry for concurrent submissions of an email", async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          submit({ email: "race@example.com", linkCode: link.code }),
        ),
      );

      expect(responses.map((res) => res.status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      const codes = responses
        .map((res) => res.body.shareCode)
        .filter((code) => code !== null);
      const entries = await entryRepo.findBy({ email: "race@example.com" });
      expect(entries).toHaveLength(1);
      expect(codes).toEqual([entries[0].code]);
    });

    it("refuses an archived link, an unknown code, and a campaign that is not an organization", async () => {
      const archived = await saveLink({ archivedAt: new Date() });
      const campaign = await campaignRepo.save(
        campaignRepo.create({ name: "Plain", code: `plain-${Math.random()}` }),
      );
      const campaignLink = await saveLink({ organizationId: campaign.id });

      await submit({ linkCode: archived.code }).expect(404);
      await submit({ linkCode: "no-such-link" }).expect(404);
      await submit({ referrerCode: "no-such-entry" }).expect(404);
      await submit({ linkCode: campaignLink.code }).expect(404);
      expect(await entryRepo.countBy({ sourceLinkId: archived.id })).toBe(0);
    });

    it.each(["linkCode", "referrerCode"])(
      "refuses a null %s rather than matching any row",
      async (field) => {
        const email = `null-${field}@example.com`;
        await submit({ email, [field]: null }).expect(400);
        expect(await entryRepo.countBy({ email })).toBe(0);
      },
    );

    it("refuses a link code and a referrer code together", async () => {
      const first = await submit({ linkCode: link.code }).expect(200);
      await submit({
        linkCode: link.code,
        referrerCode: first.body.shareCode,
      }).expect(400);
    });

    it.each<[string, EntryFields]>([
      ["an invalid commitment", { committed: "yes" }],
      ["a blank name", { name: "  " }],
      ["an invalid email", { email: "not-an-email" }],
      ["an overlong reason", { reason: "x".repeat(4001) }],
    ])("rejects %s", async (_label, fields) => {
      await submit({ linkCode: link.code, ...fields }).expect(400);
    });

    it("suspects a random-string reason, answering as for any entry", async () => {
      const email = `spam-${Math.random()}@example.com`;
      const res = await submit({
        email,
        reason: "biJrcBSgyHNPuKeQHjlts",
      }).expect(200);
      expect(res.body.shareCode).toEqual(expect.any(String));
      expect(res.headers["set-cookie"]).toBeDefined();
      expect((await entryRepo.findOneByOrFail({ email })).spamStatus).toBe(
        WaitlistSpamStatus.Suspected,
      );
    });
  });

  describe("GET /waitlist/referral", () => {
    it("brands an organization link and counts the organization's entries", async () => {
      const group = await ctx.dataSource
        .getRepository(Community)
        .save({ name: "Counted group", photo: "group.webp" });
      const counted = await saveOrganization({
        name: "Counted Org",
        communityId: group.id,
      });
      const countedLink = await saveLink({ organizationId: counted.id });
      const first = await submit({ linkCode: countedLink.code }).expect(200);
      await submit({ referrerCode: first.body.shareCode }).expect(200);
      await submit({
        linkCode: countedLink.code,
        reason: "biJrcBSgyHNPuKeQHjlts",
      }).expect(200);

      const res = await referral({ linkCode: countedLink.code }).expect(200);
      expect(res.body).toEqual({
        organization: {
          name: "Counted Org",
          picture: expect.stringContaining("group.webp"),
          entryCount: 2,
        },
        inviterName: null,
      });
    });

    it("prefers the organization's own logo to its group's photo", async () => {
      const res = await referral({ linkCode: link.code }).expect(200);
      expect(res.body.organization.picture).toContain("acme.webp");
    });

    it("names the inviter of a personal link without their email", async () => {
      const first = await submit({
        name: "Pat Inviter",
        email: "pat@example.com",
        reason: "Because",
      }).expect(200);

      const res = await referral({
        referrerCode: first.body.shareCode,
      }).expect(200);
      expect(res.body).toEqual({
        organization: null,
        inviterName: "Pat Inviter",
      });
      expect(JSON.stringify(res.body)).not.toContain("pat@example.com");
    });

    it("carries the inviter's organization with a personal link", async () => {
      const first = await submit({
        name: "Org Inviter",
        linkCode: link.code,
      }).expect(200);

      const res = await referral({
        referrerCode: first.body.shareCode,
      }).expect(200);
      expect(res.body).toEqual({
        organization: {
          name: "Acme Foundation",
          picture: expect.stringContaining("acme.webp"),
          entryCount: await entryRepo.countBy({
            organizationId: organization.id,
          }),
        },
        inviterName: "Org Inviter",
      });
    });

    it("404s for an inactive link", async () => {
      const archived = await saveLink({ archivedAt: new Date() });
      await referral({ linkCode: archived.code }).expect(404);
      await referral({ referrerCode: "missing" }).expect(404);
    });
  });

  describe("GET /waitlist/count", () => {
    it("counts only entries not yet mobilized and not spam-like", async () => {
      const before = await request(ctx.app.getHttpServer())
        .get("/waitlist/count")
        .expect(200);
      const waiting = await submit({ linkCode: link.code }).expect(200);
      const mobilized = await submit({ linkCode: link.code }).expect(200);
      await submit({
        linkCode: link.code,
        reason: "biJrcBSgyHNPuKeQHjlts",
      }).expect(200);
      await entryRepo.update(
        { code: mobilized.body.shareCode },
        { mobilizedAt: new Date() },
      );

      const after = await request(ctx.app.getHttpServer())
        .get("/waitlist/count")
        .expect(200);
      expect(after.body.waiting).toBe(before.body.waiting + 1);
      expect(waiting.body.shareCode).toEqual(expect.any(String));
    });
  });
});
