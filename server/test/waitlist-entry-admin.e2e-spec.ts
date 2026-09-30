import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import {
  type WaitlistEntryFilterDto,
  WaitlistEntrySort,
  WaitlistInviteState,
} from "../src/waitlist/dto/waitlist-entry-admin.dto";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist entry admin (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let campaignRepo: Repository<Campaign>;
  let inviteRepo: Repository<OnetimeInvite>;

  const server = () => ctx.app.getHttpServer();

  const saveOrganization = (name: string) =>
    campaignRepo.save(
      campaignRepo.create({
        name,
        code: `org-${Math.random()}`,
        kind: CampaignKind.Organization,
      }),
    );

  const saveEntry = (fields: Partial<WaitlistEntry>) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: `person-${Math.random()}@example.com`,
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: null,
        ...fields,
      }),
    );

  const saveInvite = (entry: WaitlistEntry, fields: Partial<OnetimeInvite>) =>
    inviteRepo.save(
      inviteRepo.create({
        invitee: entry.name,
        code: `invite-${Math.random()}`,
        status: OnetimeInviteStatus.LINK_UNUSED,
        organizationId: entry.organizationId,
        waitlistEntryId: entry.id,
        ...fields,
      }),
    );

  type FilterBody = {
    [K in keyof WaitlistEntryFilterDto]?: WaitlistEntryFilterDto[K] | string;
  };

  const search = (
    filter: FilterBody,
    page: { sort?: WaitlistEntrySort; offset?: number; limit?: number } = {},
  ) =>
    request(server())
      .post("/waitlist/admin/entries/search")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        filter,
        sort: WaitlistEntrySort.JoinedAsc,
        offset: 0,
        limit: 50,
        ...page,
      });

  const searchIds = async (filter: FilterBody) => {
    const res = await search(filter).expect(200);
    return res.body.entries.map((entry: { id: number }) => entry.id);
  };

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects non-admins", async () => {
    await request(server())
      .post("/waitlist/admin/entries/search")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        filter: {},
        sort: WaitlistEntrySort.JoinedAsc,
        offset: 0,
        limit: 1,
      })
      .expect(401);
  });

  it("returns an entry's attribution, statuses, and total", async () => {
    const organization = await saveOrganization("Attributed Org");
    const link = await ctx.dataSource.getRepository(WaitlistLink).save({
      code: `link-${Math.random()}`,
      organizationId: organization.id,
      channel: "Newsletter",
    });
    const referrer = await saveEntry({
      name: "Referrer",
      organizationId: organization.id,
      sourceLinkId: link.id,
    });
    const referred = await saveEntry({
      name: "Referred",
      organizationId: organization.id,
      sourceLinkId: link.id,
      referrerId: referrer.id,
      mobilizedAt: new Date(),
    });

    const res = await search({ organizationIds: [organization.id] }).expect(
      200,
    );
    expect(res.body.total).toBe(2);
    expect(res.body.entries[1]).toMatchObject({
      id: referred.id,
      name: "Referred",
      organization: { id: organization.id, name: "Attributed Org" },
      sourceLink: { id: link.id, channel: "Newsletter" },
      referrer: { id: referrer.id, name: "Referrer" },
      mobilizedAt: expect.any(String),
      unsubscribedAt: null,
      inviteState: WaitlistInviteState.None,
    });
    expect(await searchIds({ referrerIds: [referrer.id] })).toEqual([
      referred.id,
    ]);
    expect(
      await searchIds({ sourceLinkIds: [link.id], mobilized: false }),
    ).toEqual([referrer.id]);
    expect(
      await searchIds({ sourceLinkIds: [link.id], mobilized: true }),
    ).toEqual([referred.id]);
  });

  it("searches names and emails, treating wildcards literally", async () => {
    const organization = await saveOrganization("Search Org");
    const byName = await saveEntry({
      name: "Zelda 100% Unique",
      organizationId: organization.id,
    });
    const byEmail = await saveEntry({
      email: `zelda-${Math.random()}@example.com`,
      organizationId: organization.id,
    });
    await saveEntry({
      name: "Zelda 1000 Unique",
      organizationId: organization.id,
    });

    expect(
      await searchIds({ organizationIds: [organization.id], search: "100%" }),
    ).toEqual([byName.id]);
    expect(
      await searchIds({
        organizationIds: [organization.id],
        search: " ZELDA- ",
      }),
    ).toEqual([byEmail.id]);
  });

  it("filters by reason, subscription, and join date", async () => {
    const organization = await saveOrganization("Status Org");
    const withReason = await saveEntry({
      organizationId: organization.id,
      reason: "Because",
    });
    const unsubscribed = await saveEntry({
      organizationId: organization.id,
      unsubscribedAt: new Date(),
    });
    await entryRepo.update(withReason.id, {
      createdAt: new Date("2026-01-15T00:00:00Z"),
    });
    const organizationIds = [organization.id];

    expect(await searchIds({ organizationIds, hasReason: true })).toEqual([
      withReason.id,
    ]);
    expect(await searchIds({ organizationIds, hasReason: false })).toEqual([
      unsubscribed.id,
    ]);
    expect(await searchIds({ organizationIds, subscribed: false })).toEqual([
      unsubscribed.id,
    ]);
    expect(await searchIds({ organizationIds, subscribed: true })).toEqual([
      withReason.id,
    ]);
    expect(
      await searchIds({
        organizationIds,
        joinedFrom: "2026-01-01T00:00:00Z",
        joinedBefore: "2026-02-01T00:00:00Z",
      }),
    ).toEqual([withReason.id]);
  });

  it("derives invite state from the entry's invites and their claimants", async () => {
    const organization = await saveOrganization("Invite Org");
    const fields = { organizationId: organization.id };
    const none = await saveEntry(fields);
    const unused = await saveEntry(fields);
    const revoked = await saveEntry(fields);
    const claimed = await saveEntry(fields);
    const usedUnclaimed = await saveEntry(fields);
    await saveInvite(unused, {});
    await saveInvite(usedUnclaimed, { status: OnetimeInviteStatus.LINK_USED });
    await saveInvite(revoked, { deletedAt: new Date() });
    await saveInvite(claimed, { deletedAt: new Date() });
    await saveInvite(claimed, {});
    const claimedInvite = await saveInvite(claimed, {
      status: OnetimeInviteStatus.LINK_USED,
    });
    const userRepo = ctx.dataSource.getRepository(User);
    await userRepo.save(
      userRepo.create({
        email: `claimant-${Math.random()}@example.com`,
        password: "password",
        name: "Claimant",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: claimedInvite,
      }),
    );

    const res = await search({ organizationIds: [organization.id] }).expect(
      200,
    );
    const stateById = Object.fromEntries(
      res.body.entries.map((entry: { id: number; inviteState: string }) => [
        entry.id,
        entry.inviteState,
      ]),
    );
    expect(stateById).toEqual({
      [none.id]: WaitlistInviteState.None,
      [unused.id]: WaitlistInviteState.Unused,
      [revoked.id]: WaitlistInviteState.Revoked,
      [claimed.id]: WaitlistInviteState.Claimed,
      [usedUnclaimed.id]: WaitlistInviteState.Unused,
    });
    expect(
      await searchIds({
        organizationIds: [organization.id],
        inviteStates: [WaitlistInviteState.Claimed, WaitlistInviteState.None],
      }),
    ).toEqual([none.id, claimed.id]);
    expect(
      await searchIds({
        organizationIds: [organization.id],
        inviteStates: [],
        referrerIds: [],
      }),
    ).toEqual(await searchIds({ organizationIds: [organization.id] }));

    const newestFirst = await search(
      { organizationIds: [organization.id] },
      { sort: WaitlistEntrySort.JoinedDesc },
    ).expect(200);
    expect(newestFirst.body.entries.map((e: { id: number }) => e.id)).toEqual([
      usedUnclaimed.id,
      claimed.id,
      revoked.id,
      unused.id,
      none.id,
    ]);
  });

  it("sorts by organization and pages, with every matching id available", async () => {
    const alpha = await saveOrganization("Alpha Sort Org");
    const beta = await saveOrganization("Beta Sort Org");
    const betaEntry = await saveEntry({
      name: "Sorter",
      organizationId: beta.id,
    });
    const alphaEntry = await saveEntry({
      name: "Sorter",
      organizationId: alpha.id,
    });
    const unaffiliated = await saveEntry({ name: "Sorter", reason: "None" });
    const filter = { organizationIds: [alpha.id, beta.id] };

    for (const sort of [
      WaitlistEntrySort.OrganizationAsc,
      WaitlistEntrySort.OrganizationDesc,
    ]) {
      const all = await search({ search: "Sorter" }, { sort }).expect(200);
      expect(all.body.entries.at(-1).id).toBe(unaffiliated.id);
    }

    const first = await search(filter, {
      sort: WaitlistEntrySort.OrganizationAsc,
      limit: 1,
    }).expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.entries.map((e: { id: number }) => e.id)).toEqual([
      alphaEntry.id,
    ]);
    const second = await search(filter, {
      sort: WaitlistEntrySort.OrganizationAsc,
      offset: 1,
      limit: 1,
    }).expect(200);
    expect(second.body.entries.map((e: { id: number }) => e.id)).toEqual([
      betaEntry.id,
    ]);
    const descending = await search(filter, {
      sort: WaitlistEntrySort.OrganizationDesc,
    }).expect(200);
    expect(descending.body.entries.map((e: { id: number }) => e.id)).toEqual([
      betaEntry.id,
      alphaEntry.id,
    ]);

    const ids = await request(server())
      .post("/waitlist/admin/entries/ids")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ filter })
      .expect(200);
    expect(ids.body.ids).toEqual([betaEntry.id, alphaEntry.id]);
  });

  it("refuses a malformed filter", async () => {
    await request(server())
      .post("/waitlist/admin/entries/ids")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ filter: { organizationIds: 5 } })
      .expect(400);
    for (const body of [{}, { filter: [] }, { filter: { retired: [1] } }]) {
      await request(server())
        .post("/waitlist/admin/entries/ids")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body)
        .expect(400);
    }
    await search({}, { limit: 1000 }).expect(400);
    for (const field of ["mobilized", "subscribed", "hasReason"]) {
      await search({ [field]: null }).expect(400);
    }
    await search({ joinedFrom: "20260101" }).expect(400);
    await search({ joinedBefore: "2026-W01" }).expect(400);
  });
});
