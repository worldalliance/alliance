import request from "supertest";
import type { Repository } from "typeorm";
import { Campaign } from "../src/campaign/entities/campaign.entity";
import { ExternalShareTarget } from "../src/share-urls/entities/external-share-target.entity";
import { ShareUrl } from "../src/share-urls/entities/share-url.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Campaigns (e2e)", () => {
  let ctx: TestContext;
  let campaignRepo: Repository<Campaign>;
  let shareUrlRepo: Repository<ShareUrl>;
  let targetRepo: Repository<ExternalShareTarget>;
  let userRepo: Repository<User>;
  let target: ExternalShareTarget;

  const server = () => ctx.app.getHttpServer();

  const createCampaign = async (name: string): Promise<Campaign> => {
    const res = await request(server())
      .post("/campaigns")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ name })
      .expect(201);
    return res.body as Campaign;
  };

  const registerWith = async (email: string, referralCode: string) => {
    return request(server())
      .post("/auth/register")
      .send({
        email,
        password: "pass",
        name: email,
        mode: "header",
        referralCode,
      })
      .expect(201);
  };

  const findUser = (email: string) =>
    userRepo.findOneOrFail({
      where: { email },
      relations: { referredBy: true, referredByCampaign: true },
    });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    shareUrlRepo = ctx.dataSource.getRepository(ShareUrl);
    targetRepo = ctx.dataSource.getRepository(ExternalShareTarget);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  beforeEach(async () => {
    await shareUrlRepo.query("DELETE FROM share_url");
    await campaignRepo.query("DELETE FROM campaign");
    await targetRepo.query("DELETE FROM external_share_target");
    target = await targetRepo.save(
      targetRepo.create({
        name: "Campaign target",
        url: "https://example.com/join",
        paramName: "code",
      }),
    );
  });

  describe("admin CRUD", () => {
    it("rejects non-admins", async () => {
      await request(server())
        .post("/campaigns")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({ name: "Nope" })
        .expect(401);
    });

    it("creates a campaign with a generated code and lists it", async () => {
      const campaign = await createCampaign("Spring fundraiser");
      expect(campaign.id).toBeGreaterThan(0);
      expect(campaign.code).toBeTruthy();

      const list = await request(server())
        .get("/campaigns")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect((list.body as Campaign[]).some((c) => c.id === campaign.id)).toBe(
        true,
      );
    });
  });

  describe("signup attribution", () => {
    it("attributes a bare campaign code to the campaign, not a user", async () => {
      const campaign = await createCampaign("Bare code");
      await registerWith("campaign-bare@example.com", campaign.code);

      const user = await findUser("campaign-bare@example.com");
      expect(user.referralSource).toBe(ReferralSource.Campaign);
      expect(user.referredByCampaign?.id).toBe(campaign.id);
      expect(user.referredBy).toBeNull();
    });

    it("attributes a campaign-owned share link to the campaign", async () => {
      const campaign = await createCampaign("Owned link");

      const dupRes = await request(server())
        .post("/share-urls/create-duplicate")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ campaignId: campaign.id, externalTargetId: target.id })
        .expect(201);
      const row = dupRes.body as ShareUrl;
      expect(row.campaignId).toBe(campaign.id);
      expect(row.userId).toBeNull();
      expect(row.sid).toBeTruthy();

      await registerWith("campaign-sid@example.com", row.sid!);

      const user = await findUser("campaign-sid@example.com");
      expect(user.referralSource).toBe(ReferralSource.Campaign);
      expect(user.referredByCampaign?.id).toBe(campaign.id);
      expect(user.referredBy).toBeNull();
    });
  });

  describe("create-duplicate owner validation", () => {
    it("rejects when neither userId nor campaignId is given", async () => {
      await request(server())
        .post("/share-urls/create-duplicate")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ externalTargetId: target.id })
        .expect(400);
    });

    it("rejects when both userId and campaignId are given", async () => {
      const campaign = await createCampaign("Both owners");
      await request(server())
        .post("/share-urls/create-duplicate")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          userId: ctx.testUserId,
          campaignId: campaign.id,
          externalTargetId: target.id,
        })
        .expect(400);
    });
  });

  describe("GET /user/referrerProfile/:code (campaign)", () => {
    it("returns campaign display info with kind=campaign", async () => {
      const campaign = await createCampaign("Open Day");

      const res = await request(server())
        .get(`/user/referrerProfile/${campaign.code}`)
        .expect(200);
      expect(res.body.kind).toBe("campaign");
      expect(res.body.displayName).toBe("Open Day");
    });
  });

  describe("GET /share-urls/for-campaign/:campaignId", () => {
    it("returns the campaign-owned links", async () => {
      const campaign = await createCampaign("Listing");
      await request(server())
        .post("/share-urls/create-duplicate")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ campaignId: campaign.id, externalTargetId: target.id })
        .expect(201);

      const res = await request(server())
        .get(`/share-urls/for-campaign/${campaign.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      const rows = res.body as ShareUrl[];
      expect(rows.length).toBe(1);
      expect(rows[0].campaignId).toBe(campaign.id);
    });
  });
});
