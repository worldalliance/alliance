import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist admin (e2e)", () => {
  let ctx: TestContext;
  let campaignRepo: Repository<Campaign>;
  let organization: Campaign;

  const server = () => ctx.app.getHttpServer();
  const admin = {
    get: (path: string) =>
      request(server())
        .get(path)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`),
    post: (path: string, body: object) =>
      request(server())
        .post(path)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body),
    patch: (path: string, body: object) =>
      request(server())
        .patch(path)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body),
  };

  const saveCampaign = (kind: CampaignKind) =>
    campaignRepo.save(
      campaignRepo.create({
        name: "Org",
        code: `org-${Math.random()}`,
        kind,
      }),
    );

  const createLink = (body: object) =>
    admin.post("/waitlist/admin/links", {
      organizationId: organization.id,
      channel: "Newsletter",
      ...body,
    });

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    organization = await saveCampaign(CampaignKind.Organization);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("links", () => {
    it("rejects non-admins", async () => {
      await request(server())
        .get("/waitlist/admin/links")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it("creates a link that takes entries and counts them", async () => {
      const created = await createLink({
        channel: "  Social  ",
        publishedAt: "2026-09-01T12:00:00.000Z",
      }).expect(201);
      expect(created.body).toMatchObject({
        organizationId: organization.id,
        channel: "Social",
        publishedAt: "2026-09-01T12:00:00.000Z",
        archivedAt: null,
        entryCount: 0,
      });

      await request(server())
        .post("/waitlist/entries")
        .send({
          name: "Test Person",
          email: `person-${Math.random()}@example.com`,
          committed: true,
          linkCode: created.body.code,
        })
        .expect(200);

      const list = await admin.get("/waitlist/admin/links").expect(200);
      expect(
        list.body.find((link: { id: number }) => link.id === created.body.id),
      ).toMatchObject({ entryCount: 1 });
    });

    it("refuses a link for an ordinary campaign or a blank channel", async () => {
      const campaign = await saveCampaign(CampaignKind.Campaign);
      await createLink({ organizationId: campaign.id }).expect(400);
      await createLink({ organizationId: 999999 }).expect(400);
      await createLink({ channel: "   " }).expect(400);
    });

    it("edits, archives, and restores a link", async () => {
      const created = await createLink({}).expect(201);
      const path = `/waitlist/admin/links/${created.body.id}`;

      const edited = await admin
        .patch(path, { channel: "Email", publishedAt: null, archived: true })
        .expect(200);
      expect(edited.body).toMatchObject({
        channel: "Email",
        publishedAt: null,
        archivedAt: expect.any(String),
      });
      await request(server())
        .get("/waitlist/referral")
        .query({ linkCode: created.body.code })
        .expect(404);

      const restored = await admin.patch(path, { archived: false }).expect(200);
      expect(restored.body.archivedAt).toBeNull();
      await request(server())
        .get("/waitlist/referral")
        .query({ linkCode: created.body.code })
        .expect(200);
    });

    it("keeps an archived link's original archive time", async () => {
      const created = await createLink({}).expect(201);
      const path = `/waitlist/admin/links/${created.body.id}`;
      const first = await admin.patch(path, { archived: true }).expect(200);
      const second = await admin.patch(path, { archived: true }).expect(200);
      expect(second.body.archivedAt).toBe(first.body.archivedAt);
    });

    it("refuses a malformed edit and sets a publication date", async () => {
      const created = await createLink({}).expect(201);
      const path = `/waitlist/admin/links/${created.body.id}`;
      for (const body of [
        { channel: "  " },
        { channel: null },
        { archived: "yes" },
        { archived: null },
        { publishedAt: "nope" },
      ]) {
        await admin.patch(path, body).expect(400);
      }

      const published = await admin
        .patch(path, { publishedAt: "2026-09-02T12:00:00.000Z" })
        .expect(200);
      expect(published.body.publishedAt).toBe("2026-09-02T12:00:00.000Z");
    });

    it("404s for a missing link", async () => {
      await admin
        .patch("/waitlist/admin/links/999999", { channel: "Email" })
        .expect(404);
    });
  });
});
