import request from "supertest";
import { Campaign } from "../src/campaign/entities/campaign.entity";
import {
  ShareUrl,
  ShareUrlKind,
} from "../src/share-urls/entities/share-url.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Invite link admin (e2e)", () => {
  let ctx: TestContext;
  let individual: OnetimeInvite;
  let unused: OnetimeInvite;
  let multi: ShareUrl;
  let campaign: Campaign;
  let owner: User;

  const search = (query: Record<string, string | number> = {}) =>
    request(ctx.app.getHttpServer())
      .get("/share-urls/admin/invite-links")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .query(query);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const userRepo = ctx.dataSource.getRepository(User);
    owner = await userRepo.save(
      userRepo.create({
        name: "Link owner",
        email: "link-owner@example.com",
        password: "test",
        referralSource: ReferralSource.None,
      }),
    );
    const invites = ctx.dataSource.getRepository(OnetimeInvite);
    individual = await invites.save({
      invitee: "Individual recipient",
      code: "individual-metrics",
      status: OnetimeInviteStatus.LINK_USED,
      deletedAt: new Date(),
    });
    unused = await invites.save({
      invitee: "Unused recipient",
      code: "unused-metrics",
      status: OnetimeInviteStatus.LINK_UNUSED,
    });
    await invites.update(individual.id, {
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    await invites.update(unused.id, {
      createdAt: new Date("2026-02-01T12:00:00Z"),
    });
    multi = await ctx.dataSource.getRepository(ShareUrl).save({
      kind: ShareUrlKind.Invite,
      userId: owner.id,
      sid: "multi-metrics",
      url: "https://example.com/signup?ref=multi-metrics",
      label: "Multi metrics",
    });
    campaign = await ctx.dataSource
      .getRepository(Campaign)
      .save({ name: "Metrics campaign", code: "campaign-metrics" });
    const individualAccount = await userRepo.save(
      userRepo.create({
        name: "Individual account",
        email: "individual-account@example.com",
        password: "test",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: individual,
      }),
    );
    const trackedAccount = await userRepo.save(
      userRepo.create({
        name: "Tracked account",
        email: "tracked-account@example.com",
        password: "test",
        referralSource: ReferralSource.InviteShareLink,
        referredByShareUrl: multi,
        referredById: owner.id,
      }),
    );
    const events = ctx.dataSource.getRepository(ContractEvent);
    await events.save([
      {
        user: { id: individualAccount.id },
        type: ContractEventType.SIGNED,
        date: new Date("2026-03-01T12:00:00Z"),
        contractId: ctx.defaultContractId,
      },
      {
        user: { id: individualAccount.id },
        type: ContractEventType.SUSPENDED,
        date: new Date("2026-03-02T12:00:00Z"),
      },
      {
        user: { id: trackedAccount.id },
        type: ContractEventType.SIGNED,
        date: new Date("2026-03-01T12:00:00Z"),
        contractId: ctx.defaultContractId,
      },
      {
        user: { id: trackedAccount.id },
        type: ContractEventType.SUSPENDED,
        date: new Date("2026-03-02T12:00:00Z"),
      },
      {
        user: { id: trackedAccount.id },
        type: ContractEventType.SIGNED,
        date: new Date("2026-03-03T12:00:00Z"),
        contractId: ctx.defaultContractId,
      },
      {
        user: { id: trackedAccount.id },
        type: ContractEventType.SUSPENDED,
        date: new Date("2099-03-03T12:00:00Z"),
      },
    ]);
    for (let index = 0; index < 2; index++) {
      await userRepo.save(
        userRepo.create({
          name: "Campaign account",
          email: `campaign-account-${index}@example.com`,
          password: "test",
          referralSource: ReferralSource.Campaign,
          referredByCampaignId: campaign.id,
        }),
      );
    }
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("requires an admin and validates filters, sorting, and page bounds", async () => {
    await request(ctx.app.getHttpServer())
      .get("/share-urls/admin/invite-links")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
    const invalidQueries: Record<string, string | number>[] = [
      { kind: "invalid" },
      { sort: "invalid" },
      { page: 0 },
      { limit: 201 },
    ];
    for (const query of invalidQueries) await search(query).expect(400);
  });

  it("counts initial signers once, retains active re-signers, and isolates attribution", async () => {
    const response = await search().expect(200);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `individual:${individual.id}`,
          kind: "individual",
          accountsCreated: 1,
          initialSigners: 1,
          retainedSigners: 0,
        }),
        expect.objectContaining({
          id: `individual:${unused.id}`,
          accountsCreated: 0,
          initialSigners: 0,
          retainedSigners: 0,
        }),
        expect.objectContaining({
          id: `share:${multi.id}`,
          kind: "multi_use",
          accountsCreated: 1,
          initialSigners: 1,
          retainedSigners: 1,
          url: expect.stringContaining("ref=multi-metrics"),
        }),
        expect.objectContaining({
          id: `member:${owner.id}`,
          accountsCreated: 0,
          initialSigners: 0,
          retainedSigners: 0,
        }),
        expect.objectContaining({
          id: `campaign:${campaign.id}`,
          accountsCreated: 2,
          initialSigners: 0,
          retainedSigners: 0,
        }),
      ]),
    );
  });

  it("filters and paginates before returning rows and sorts by age or account count", async () => {
    const first = await search({
      kind: "individual",
      sort: "oldest",
      limit: 1,
    }).expect(200);
    expect(first.body).toMatchObject({
      page: 1,
      limit: 1,
      totalCount: 2,
      totalPages: 2,
      items: [expect.objectContaining({ id: `individual:${individual.id}` })],
    });
    const second = await search({
      kind: "individual",
      sort: "oldest",
      limit: 1,
      page: 2,
    }).expect(200);
    expect(second.body.items).toEqual([
      expect.objectContaining({ id: `individual:${unused.id}` }),
    ]);
    const newest = await search({
      kind: "individual",
      sort: "newest",
      limit: 1,
    }).expect(200);
    expect(newest.body.items[0].id).toBe(`individual:${unused.id}`);
    const most = await search({
      kind: "multi_use",
      sort: "most_used",
      limit: 1,
    }).expect(200);
    expect(most.body.items).toEqual([
      expect.objectContaining({
        id: `campaign:${campaign.id}`,
        accountsCreated: 2,
      }),
    ]);
    const least = await search({
      kind: "individual",
      sort: "least_used",
      limit: 1,
    }).expect(200);
    expect(least.body.items[0].id).toBe(`individual:${unused.id}`);
    const empty = await search({
      kind: "individual",
      page: 3,
      limit: 1,
    }).expect(200);
    expect(empty.body).toMatchObject({ totalCount: 2, items: [] });
  });
});
