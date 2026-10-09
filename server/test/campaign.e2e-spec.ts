import request from "supertest";
import type { Repository } from "typeorm";
import { CampaignService } from "../src/campaign/campaign.service";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { Community } from "../src/community/entities/community.entity";
import { ExternalShareTarget } from "../src/share-urls/entities/external-share-target.entity";
import { ShareUrl } from "../src/share-urls/entities/share-url.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { createTestApp, TestContext, waitForLockWait } from "./e2e-test-utils";

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
        timeZone: "America/Los_Angeles",
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
    await shareUrlRepo.query("DELETE FROM waitlist_entry");
    await shareUrlRepo.query("DELETE FROM waitlist_link");
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

    it("leaves a campaign deleted while the signup resolves its code out of the attribution", async () => {
      const campaign = await createCampaign("Deleted mid-signup");
      const users = ctx.app.get(UserService);
      const resolveReferral = users.resolveReferral.bind(users);
      const resolve = jest
        .spyOn(users, "resolveReferral")
        .mockImplementation(async (...args) => {
          const resolution = await resolveReferral(...args);
          await campaignRepo.softDelete(campaign.id);
          return resolution;
        });

      try {
        await registerWith("campaign-deleted@example.com", campaign.code);
      } finally {
        resolve.mockRestore();
      }

      const user = await findUser("campaign-deleted@example.com");
      expect(user.referralSource).toBe(ReferralSource.Campaign);
      expect(user.referredByCampaign).toBeNull();
      expect(
        (await userRepo.findOneByOrFail({ id: user.id })).referredByCampaignId,
      ).toBeNull();
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

    it("refuses a deleted campaign", async () => {
      const campaign = await createCampaign("Deleted owner");
      await campaignRepo.softDelete(campaign.id);
      await request(server())
        .post("/share-urls/create-duplicate")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ campaignId: campaign.id, externalTargetId: target.id })
        .expect(404);
      expect(
        await shareUrlRepo.find({
          where: { campaignId: campaign.id },
          withDeleted: true,
        }),
      ).toEqual([]);
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

  describe("organization group", () => {
    const saveCampaign = (kind: CampaignKind, communityId: number | null) =>
      campaignRepo.save(
        campaignRepo.create({
          name: "Org",
          code: `code-${Math.random()}`,
          kind,
          communityId,
        }),
      );

    const saveGroup = () =>
      ctx.dataSource.getRepository(Community).save({ name: "Org group" });

    it("gives a group to at most one organization, and lets several have none", async () => {
      const group = await saveGroup();
      await saveCampaign(CampaignKind.Organization, null);
      await saveCampaign(CampaignKind.Organization, null);
      await saveCampaign(CampaignKind.Organization, group.id);
      await expect(
        saveCampaign(CampaignKind.Organization, group.id),
      ).rejects.toThrow(/unique/i);
    });

    it("refuses a group on an ordinary campaign", async () => {
      const group = await saveGroup();
      await expect(
        saveCampaign(CampaignKind.Campaign, group.id),
      ).rejects.toThrow(/CHK_campaign_community_organization/);
    });

    it("keeps an organization whose group is deleted", async () => {
      const group = await saveGroup();
      const organization = await saveCampaign(
        CampaignKind.Organization,
        group.id,
      );
      await ctx.dataSource.getRepository(Community).delete(group.id);
      const row = await campaignRepo.findOneByOrFail({ id: organization.id });
      expect(row.communityId).toBeNull();
    });

    it("creates an ordinary campaign without a group", async () => {
      const campaign = await createCampaign("Ordinary");
      const row = await campaignRepo.findOneByOrFail({ id: campaign.id });
      expect(row.kind).toBe(CampaignKind.Campaign);
      expect(row.communityId).toBeNull();
    });

    it("creates an organization directly, refusing a null kind", async () => {
      const res = await request(server())
        .post("/campaigns")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "New org", kind: CampaignKind.Organization })
        .expect(201);
      expect(res.body.kind).toBe(CampaignKind.Organization);

      await request(server())
        .post("/campaigns")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Null kind", kind: null })
        .expect(400);
    });

    describe("PATCH /campaigns/:id", () => {
      const patch = (id: number, body: object) =>
        request(server())
          .patch(`/campaigns/${id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(body);

      it("designates an organization and assigns its group", async () => {
        const campaign = await createCampaign("Becomes an org");
        const group = await saveGroup();
        const res = await patch(campaign.id, {
          kind: CampaignKind.Organization,
          communityId: group.id,
        }).expect(200);
        expect(res.body).toMatchObject({
          kind: CampaignKind.Organization,
          communityId: group.id,
        });

        await patch(campaign.id, { communityId: null }).expect(200);
        const row = await campaignRepo.findOneByOrFail({ id: campaign.id });
        expect(row.communityId).toBeNull();
      });

      it("refuses a group another organization has", async () => {
        const group = await saveGroup();
        await saveCampaign(CampaignKind.Organization, group.id);
        const other = await saveCampaign(CampaignKind.Organization, null);
        await patch(other.id, { communityId: group.id }).expect(409);
      });

      it("refuses a group on an ordinary campaign", async () => {
        const group = await saveGroup();
        const campaign = await createCampaign("Ordinary");
        await patch(campaign.id, { communityId: group.id }).expect(400);

        const organization = await saveCampaign(
          CampaignKind.Organization,
          group.id,
        );
        await patch(organization.id, { kind: CampaignKind.Campaign }).expect(
          400,
        );
      });

      it("waits for a link being created before turning its organization into a campaign", async () => {
        const organization = await saveCampaign(
          CampaignKind.Organization,
          null,
        );
        const runner = ctx.dataSource.createQueryRunner();
        await runner.startTransaction();
        try {
          await runner.query(
            "SELECT id FROM campaign WHERE id = $1 FOR SHARE",
            [organization.id],
          );
          const demotion = patch(organization.id, {
            kind: CampaignKind.Campaign,
          }).then((res) => res.status);
          await waitForLockWait(ctx.dataSource);
          await runner.query(
            `INSERT INTO waitlist_link (code, "organizationId", channel) VALUES ($1, $2, $3)`,
            [`link-${Math.random()}`, organization.id, "Newsletter"],
          );
          await runner.commitTransaction();
          expect(await demotion).toBe(409);
        } finally {
          await runner.release();
        }
      });

      it("keeps an organization with waitlist links or entries one", async () => {
        const withLink = await saveCampaign(CampaignKind.Organization, null);
        await ctx.dataSource.getRepository(WaitlistLink).save({
          code: `link-${Math.random()}`,
          organizationId: withLink.id,
          channel: "Newsletter",
        });
        await patch(withLink.id, { kind: CampaignKind.Campaign }).expect(409);

        const withEntry = await saveCampaign(CampaignKind.Organization, null);
        await ctx.dataSource.getRepository(WaitlistEntry).save({
          name: "Entrant",
          email: `entrant-${Math.random()}@example.com`,
          code: `code-${Math.random()}`,
          committedAt: new Date(),
          organizationId: withEntry.id,
        });
        await patch(withEntry.id, { kind: CampaignKind.Campaign }).expect(409);

        const empty = await saveCampaign(CampaignKind.Organization, null);
        await patch(empty.id, { kind: CampaignKind.Campaign }).expect(200);
      });

      it("refuses a missing group and a null kind", async () => {
        const organization = await saveCampaign(
          CampaignKind.Organization,
          null,
        );
        await patch(organization.id, { communityId: 999999 }).expect(400);
        await patch(organization.id, { kind: null }).expect(400);
      });

      it("refuses a deleted group", async () => {
        const organization = await saveCampaign(
          CampaignKind.Organization,
          null,
        );
        const group = await saveGroup();
        await ctx.dataSource.getRepository(Community).softDelete(group.id);
        await patch(organization.id, { communityId: group.id }).expect(400);
        const row = await campaignRepo.findOneByOrFail({ id: organization.id });
        expect(row.communityId).toBeNull();
      });

      it("refuses a null name", async () => {
        const campaign = await createCampaign("Keeps its name");
        await patch(campaign.id, { name: null }).expect(400);
      });
    });
  });

  it("does not deadlock re-saving an organization's group while it is deleted", async () => {
    const group = await ctx.dataSource
      .getRepository(Community)
      .save({ name: "Doomed org group" });
    const campaigns = ctx.dataSource.getRepository(Campaign);
    const org = await campaigns.save(
      campaigns.create({
        name: "Org with a doomed group",
        code: `code-${Math.random()}`,
        kind: CampaignKind.Organization,
        communityId: group.id,
      }),
    );
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      // What `DELETE FROM community` takes first.
      await deletion.query(
        "SELECT id FROM community WHERE id = $1 FOR UPDATE",
        [group.id],
      );
      const updated = ctx.app
        .get(CampaignService)
        .update(org.id, { name: "Renamed", communityId: group.id })
        .then(
          () => "updated",
          (err: Error) => err.message,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.query("DELETE FROM community WHERE id = $1", [group.id]);
      await deletion.commitTransaction();

      expect(await updated).toBe("That group does not exist");
    } finally {
      await deletion.release();
    }
  });
});
