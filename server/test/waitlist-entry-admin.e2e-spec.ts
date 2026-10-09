import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
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
import { WaitlistCohort } from "../src/waitlist/entities/waitlist-cohort.entity";
import { WaitlistEmailBatch } from "../src/waitlist/entities/waitlist-email-batch.entity";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "../src/waitlist/entities/waitlist-email-recipient.entity";
import {
  WaitlistEntryAction,
  WaitlistEntryActionKind,
} from "../src/waitlist/entities/waitlist-entry-action.entity";
import {
  WaitlistEntry,
  WaitlistSpamStatus,
} from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { WaitlistTag } from "../src/waitlist/entities/waitlist-tag.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import {
  createTestApp,
  TestContext,
  waitForLockWait,
  writeDuringDeletion,
} from "./e2e-test-utils";

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

  const post = (path: string, entryIds: number[]) =>
    request(server())
      .post(`/waitlist/admin/entries/${path}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ entryIds });

  const actionsOf = (entryId: number) =>
    ctx.dataSource
      .getRepository(WaitlistEntryAction)
      .find({ where: { entryId }, order: { id: "ASC" } });

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

  it("returns every contract event of linked accounts newest first", async () => {
    const organization = await saveOrganization("Contract History Org");
    const waiting = await saveEntry({ organizationId: organization.id });
    const claimed = await saveEntry({ organizationId: organization.id });
    const noEvents = await saveEntry({ organizationId: organization.id });
    const userRepo = ctx.dataSource.getRepository(User);
    const invite = await saveInvite(claimed, { deletedAt: new Date() });
    const user = await userRepo.save(
      userRepo.create({
        email: `history-${Math.random()}@example.com`,
        password: "password",
        name: "History Test",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      }),
    );
    await userRepo.save(
      userRepo.create({
        email: `no-events-${Math.random()}@example.com`,
        password: "password",
        name: "No Events Test",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: await saveInvite(noEvents, {}),
      }),
    );
    const dates = [
      "2026-09-01T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      "2026-09-03T12:00:00.000Z",
      "2026-09-04T12:00:00.000Z",
    ];
    const types = [
      ContractEventType.SIGNED,
      ContractEventType.SUSPENDED,
      ContractEventType.SIGNED,
      ContractEventType.SUSPENDED,
    ];
    const eventRepo = ctx.dataSource.getRepository(ContractEvent);
    for (const [index, type] of types.entries()) {
      await eventRepo.save({
        user: { id: user.id },
        type,
        date: new Date(dates[index]),
        contractId:
          type === ContractEventType.SIGNED ? ctx.defaultContractId : null,
      });
    }
    const res = await search({ organizationIds: [organization.id] }).expect(
      200,
    );
    expect(res.body.entries).toEqual([
      expect.objectContaining({
        id: waiting.id,
        inviteState: WaitlistInviteState.None,
        contractEvents: [],
      }),
      expect.objectContaining({
        id: claimed.id,
        inviteState: WaitlistInviteState.Claimed,
        contractEvents: [...types].reverse().map((type, index) => ({
          type,
          date: dates[3 - index],
          automatic: false,
          contractId:
            type === ContractEventType.SIGNED ? ctx.defaultContractId : null,
        })),
      }),
      expect.objectContaining({
        id: noEvents.id,
        inviteState: WaitlistInviteState.Claimed,
        contractEvents: [],
      }),
    ]);
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

  describe("tags", () => {
    const admin = (method: "post" | "patch" | "delete" | "get", path: string) =>
      request(server())
        [method](`/waitlist/admin/tags${path}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    it("tags and untags entries, and filters by any selected tag", async () => {
      const organization = await saveOrganization("Tag Org");
      const first = await saveEntry({ organizationId: organization.id });
      const second = await saveEntry({ organizationId: organization.id });
      const untagged = await saveEntry({ organizationId: organization.id });
      const speakers = await admin("post", "")
        .send({ name: " Speakers " })
        .expect(201);
      const hosts = await admin("post", "").send({ name: "Hosts" }).expect(201);
      expect(speakers.body.name).toBe("Speakers");

      const added = await admin("post", `/${speakers.body.id}/add`)
        .send({ entryIds: [first.id, second.id, 999999] })
        .expect(200);
      expect(added.body.changed).toBe(2);
      const again = await admin("post", `/${speakers.body.id}/add`)
        .send({ entryIds: [first.id] })
        .expect(200);
      expect(again.body.changed).toBe(0);
      await admin("post", `/${hosts.body.id}/add`)
        .send({ entryIds: [first.id] })
        .expect(200);

      const organizationIds = [organization.id];
      const res = await search({ organizationIds }).expect(200);
      expect(res.body.entries[0].tags).toEqual([
        { id: hosts.body.id, name: "Hosts" },
        { id: speakers.body.id, name: "Speakers" },
      ]);
      expect(
        await searchIds({
          organizationIds,
          tagIds: [speakers.body.id, hosts.body.id],
        }),
      ).toEqual([first.id, second.id]);

      const removed = await admin("post", `/${speakers.body.id}/remove`)
        .send({ entryIds: [second.id, untagged.id] })
        .expect(200);
      expect(removed.body.changed).toBe(1);
      const list = await admin("get", "").expect(200);
      expect(
        list.body.find((tag: { id: number }) => tag.id === speakers.body.id),
      ).toMatchObject({ entryCount: 1 });
    });

    it("keeps tag names unique regardless of case", async () => {
      const tag = await admin("post", "").send({ name: "Donors" }).expect(201);
      await admin("post", "").send({ name: "donors" }).expect(409);
      await admin("post", "").send({ name: "  " }).expect(400);
      const other = await admin("post", "").send({ name: "Press" }).expect(201);
      await admin("patch", `/${other.body.id}`)
        .send({ name: "DONORS" })
        .expect(409);
      const renamed = await admin("patch", `/${tag.body.id}`)
        .send({ name: "Major donors" })
        .expect(200);
      expect(renamed.body.name).toBe("Major donors");
    });

    it("deletes a tag with its memberships, leaving the entries", async () => {
      const entry = await saveEntry({ reason: "Tagged then deleted" });
      const tag = await admin("post", "")
        .send({ name: "Temporary" })
        .expect(201);
      await admin("post", `/${tag.body.id}/add`)
        .send({ entryIds: [entry.id] })
        .expect(200);
      await admin("delete", `/${tag.body.id}`).expect(204);

      expect(await entryRepo.existsBy({ id: entry.id })).toBe(true);
      await admin("post", `/${tag.body.id}/add`)
        .send({ entryIds: [entry.id] })
        .expect(404);
      await admin("delete", `/${tag.body.id}`).expect(404);
    });
    it("keeps a tag deleted while it is renamed", async () => {
      const tags = ctx.dataSource.getRepository(WaitlistTag);
      const tag = await admin("post", "").send({ name: "Gone" }).expect(201);

      const res = await writeDuringDeletion({
        dataSource: ctx.dataSource,
        target: WaitlistTag,
        id: tag.body.id,
        write: async () =>
          admin("patch", `/${tag.body.id}`).send({ name: "Renamed" }),
      });

      expect(res).toMatchObject({ status: 404 });
      expect(
        await tags.findOneOrFail({
          where: { id: tag.body.id },
          withDeleted: true,
        }),
      ).toMatchObject({ name: "Gone", deletedAt: expect.any(Date) });
    });

    it("tags no entry with a tag deleted while it is added", async () => {
      const entry = await saveEntry({ reason: "Tagged with a deleted tag" });
      const tag = await admin("post", "").send({ name: "Going" }).expect(201);

      const res = await writeDuringDeletion({
        dataSource: ctx.dataSource,
        target: WaitlistTag,
        id: tag.body.id,
        write: async () =>
          admin("post", `/${tag.body.id}/add`).send({ entryIds: [entry.id] }),
      });

      expect(res).toMatchObject({ status: 404 });
      const [{ count }] = await ctx.dataSource.query(
        `SELECT count(*)::int AS count FROM waitlist_entry_tag WHERE "tagId" = $1`,
        [tag.body.id],
      );
      expect(count).toBe(0);
    });
  });

  describe("mobilizing", () => {
    it("marks and unmarks only entries whose status changes, recording who", async () => {
      const waiting = await saveEntry({ reason: "Waiting" });
      const earlier = new Date("2026-01-01T00:00:00Z");
      const mobilized = await saveEntry({
        reason: "Already mobilized",
        mobilizedAt: earlier,
      });

      const marked = await post("mobilize", [
        waiting.id,
        mobilized.id,
        999999,
      ]).expect(200);
      expect(marked.body.changed).toBe(1);
      expect(
        (await entryRepo.findOneByOrFail({ id: mobilized.id })).mobilizedAt,
      ).toEqual(earlier);
      expect(
        (await entryRepo.findOneByOrFail({ id: waiting.id })).mobilizedAt,
      ).toEqual(expect.any(Date));
      expect(await actionsOf(mobilized.id)).toEqual([]);

      const stillWaiting = await saveEntry({ reason: "Still waiting" });
      const undone = await post("unmobilize", [
        waiting.id,
        stillWaiting.id,
      ]).expect(200);
      expect(undone.body.changed).toBe(1);
      expect(await actionsOf(stillWaiting.id)).toEqual([]);
      expect(
        (await entryRepo.findOneByOrFail({ id: waiting.id })).mobilizedAt,
      ).toBeNull();
      expect(await actionsOf(waiting.id)).toMatchObject([
        {
          kind: WaitlistEntryActionKind.ManualMobilize,
          staffUserId: ctx.adminUserId,
        },
        {
          kind: WaitlistEntryActionKind.UndoMobilize,
          staffUserId: ctx.adminUserId,
        },
      ]);
    });

    it("takes more ids than a statement has bind parameters", async () => {
      const entry = await saveEntry({ reason: "One of many" });
      const entryIds = [
        ...Array.from({ length: 70000 }, (_, i) => -1 - i),
        entry.id,
      ];
      const marked = await post("mobilize", entryIds).expect(200);
      expect(marked.body.changed).toBe(1);
      const undone = await post("unmobilize", entryIds).expect(200);
      expect(undone.body.changed).toBe(1);
    });

    it("leaves an entry's invites alone when undoing", async () => {
      const entry = await saveEntry({
        reason: "Invited",
        mobilizedAt: new Date(),
      });
      const invite = await saveInvite(entry, {});
      await post("unmobilize", [entry.id]).expect(200);
      expect(await inviteRepo.findOneByOrFail({ id: invite.id })).toMatchObject(
        { deletedAt: null },
      );
    });

    it("rejects non-admins", async () => {
      await request(server())
        .post("/waitlist/admin/entries/mobilize")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({ entryIds: [] })
        .expect(401);
    });
  });

  describe("spam", () => {
    it("filters by spam status, applying no default", async () => {
      const organization = await saveOrganization("Spam Org");
      const organizationIds = [organization.id];
      const clean = await saveEntry({ organizationId: organization.id });
      const suspected = await saveEntry({
        organizationId: organization.id,
        spamStatus: WaitlistSpamStatus.Suspected,
      });
      const notSpam = await saveEntry({
        organizationId: organization.id,
        spamStatus: WaitlistSpamStatus.NotSpam,
      });

      expect(await searchIds({ organizationIds })).toEqual([
        clean.id,
        suspected.id,
        notSpam.id,
      ]);
      expect(
        await searchIds({
          organizationIds,
          spamStatuses: [WaitlistSpamStatus.Clean, WaitlistSpamStatus.NotSpam],
        }),
      ).toEqual([clean.id, notSpam.id]);
      const res = await search({
        organizationIds,
        spamStatuses: [WaitlistSpamStatus.Suspected],
      }).expect(200);
      expect(res.body.entries).toMatchObject([
        { id: suspected.id, spamStatus: WaitlistSpamStatus.Suspected },
      ]);
    });

    it("marks only entries whose status changes, recording who", async () => {
      const suspected = await saveEntry({
        reason: "Suspected",
        spamStatus: WaitlistSpamStatus.Suspected,
      });
      const spam = await saveEntry({
        reason: "Spam",
        spamStatus: WaitlistSpamStatus.Spam,
      });

      const marked = await post("mark-spam", [suspected.id, spam.id]).expect(
        200,
      );
      expect(marked.body.changed).toBe(1);
      expect(await actionsOf(spam.id)).toEqual([]);

      const unmarked = await post("mark-not-spam", [suspected.id]).expect(200);
      expect(unmarked.body.changed).toBe(1);
      expect(
        (await entryRepo.findOneByOrFail({ id: suspected.id })).spamStatus,
      ).toBe(WaitlistSpamStatus.NotSpam);
      expect(await actionsOf(suspected.id)).toMatchObject([
        {
          kind: WaitlistEntryActionKind.MarkSpam,
          staffUserId: ctx.adminUserId,
        },
        {
          kind: WaitlistEntryActionKind.MarkNotSpam,
          staffUserId: ctx.adminUserId,
        },
      ]);
    });

    it("rejects non-admins", async () => {
      await request(server())
        .post("/waitlist/admin/entries/mark-spam")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({ entryIds: [] })
        .expect(401);
    });
  });

  describe("revoking invites", () => {
    it("revokes only invites signup could still claim, leaving mobilization alone", async () => {
      const mobilizedAt = new Date("2026-01-01T00:00:00Z");
      const entry = await saveEntry({ reason: "Revoked", mobilizedAt });
      const unused = await saveInvite(entry, {});
      const usedUnclaimed = await saveInvite(entry, {
        status: OnetimeInviteStatus.LINK_USED,
      });
      const alreadyRevoked = new Date("2026-02-01T00:00:00Z");
      const revoked = await saveInvite(entry, { deletedAt: alreadyRevoked });
      const unselected = await saveInvite(
        await saveEntry({ reason: "Not selected" }),
        {},
      );
      const unrelated = await inviteRepo.save(
        inviteRepo.create({
          invitee: "Someone",
          code: `invite-${Math.random()}`,
          status: OnetimeInviteStatus.LINK_UNUSED,
        }),
      );
      const claimedEntry = await saveEntry({ reason: "Claimed" });
      const claimed = await saveInvite(claimedEntry, {
        status: OnetimeInviteStatus.LINK_USED,
      });
      const userRepo = ctx.dataSource.getRepository(User);
      await userRepo.save(
        userRepo.create({
          email: `claimant-${Math.random()}@example.com`,
          password: "password",
          name: "Claimant",
          referralSource: ReferralSource.OnetimeInvite,
          referredByInvite: claimed,
        }),
      );

      const res = await request(server())
        .post("/waitlist/admin/entries/revoke-invites")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ entryIds: [entry.id, claimedEntry.id] })
        .expect(200);

      expect(res.body.changed).toBe(2);
      const deletedAt = async (invite: OnetimeInvite) =>
        (
          await inviteRepo.findOneOrFail({
            where: { id: invite.id },
            withDeleted: true,
          })
        ).deletedAt;
      expect(await deletedAt(unused)).toEqual(expect.any(Date));
      expect(await deletedAt(usedUnclaimed)).toEqual(expect.any(Date));
      expect(await deletedAt(revoked)).toEqual(alreadyRevoked);
      expect(await deletedAt(claimed)).toBeNull();
      expect(await deletedAt(unselected)).toBeNull();
      expect(await deletedAt(unrelated)).toBeNull();
      expect(
        (await entryRepo.findOneByOrFail({ id: entry.id })).mobilizedAt,
      ).toEqual(mobilizedAt);
      expect(
        await searchIds({ inviteStates: [WaitlistInviteState.Revoked] }),
      ).toContain(entry.id);
    });

    it("waits for a signup claiming the invite, then leaves it", async () => {
      const entry = await saveEntry({ reason: "Claiming" });
      const invite = await saveInvite(entry, {});
      const runner = ctx.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(
          `UPDATE onetime_invite SET status = $2, "usedAt" = now() WHERE id = $1`,
          [invite.id, OnetimeInviteStatus.LINK_USED],
        );
        await runner.manager.save(
          runner.manager.create(User, {
            email: `claimant-${Math.random()}@example.com`,
            password: "password",
            name: "Claimant",
            referralSource: ReferralSource.OnetimeInvite,
            referredByInvite: invite,
          }),
        );
        const revoke = request(server())
          .post("/waitlist/admin/entries/revoke-invites")
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ entryIds: [entry.id] })
          .then((res) => res);
        await waitForLockWait(ctx.dataSource);
        await runner.commitTransaction();
        expect((await revoke).body.changed).toBe(0);
      } finally {
        await runner.release();
      }
      expect(
        (
          await inviteRepo.findOneOrFail({
            where: { id: invite.id },
            withDeleted: true,
          })
        ).deletedAt,
      ).toBeNull();
    });

    it("leaves an invite a waitlist email is sending", async () => {
      const entry = await saveEntry({ reason: "Being emailed" });
      const invite = await saveInvite(entry, {});
      const batch = await ctx.dataSource
        .getRepository(WaitlistEmailBatch)
        .save({
          requestId: crypto.randomUUID(),
          subject: "Join",
          body: "#{signupLink}",
          mobilize: false,
          includeClaimed: false,
          staffUserId: null,
        });
      await ctx.dataSource.getRepository(WaitlistEmailRecipient).save({
        batchId: batch.id,
        entryId: entry.id,
        status: WaitlistEmailRecipientStatus.Sending,
        inviteId: invite.id,
      });

      const res = await request(server())
        .post("/waitlist/admin/entries/revoke-invites")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ entryIds: [entry.id] })
        .expect(200);

      expect(res.body.changed).toBe(0);
      expect(
        (
          await inviteRepo.findOneOrFail({
            where: { id: invite.id },
            withDeleted: true,
          })
        ).deletedAt,
      ).toBeNull();
    });
  });

  describe("cohorts", () => {
    const admin = (method: "post" | "patch" | "delete" | "get", path: string) =>
      request(server())
        [method](`/waitlist/admin/cohorts${path}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    it("saves a filter whose entries are recomputed on use", async () => {
      const organization = await saveOrganization("Cohort Org");
      const filter = {
        organizationIds: [organization.id],
        mobilized: false,
        joinedFrom: "2026-01-01T00:00:00.000Z",
      };
      const created = await admin("post", "")
        .send({ name: " Waiting at Cohort Org ", filter })
        .expect(201);
      expect(created.body).toMatchObject({
        name: "Waiting at Cohort Org",
        filter,
      });

      const list = await admin("get", "").expect(200);
      const saved = list.body.find(
        (cohort: { id: number }) => cohort.id === created.body.id,
      );
      const before = await searchIds(saved.filter);
      const joined = await saveEntry({ organizationId: organization.id });
      expect(await searchIds(saved.filter)).toEqual([...before, joined.id]);
    });

    it("renames and refilters a cohort, keeping names unique", async () => {
      const created = await admin("post", "")
        .send({ name: "Unsubscribed", filter: { subscribed: false } })
        .expect(201);
      await admin("post", "")
        .send({ name: "unsubscribed", filter: {} })
        .expect(409);
      const updated = await admin("patch", `/${created.body.id}`)
        .send({ filter: { subscribed: false, hasReason: true } })
        .expect(200);
      expect(updated.body).toMatchObject({
        name: "Unsubscribed",
        filter: { subscribed: false, hasReason: true },
      });
      for (const filter of [{ tagIds: "nope" }, [], null]) {
        await admin("patch", `/${created.body.id}`)
          .send({ filter })
          .expect(400);
      }
      await admin("post", "").send({ name: "No filter" }).expect(400);
      await admin("post", "")
        .send({ name: "List filter", filter: [] })
        .expect(400);
      await admin("post", "")
        .send({ name: "Retired field", filter: { retired: true } })
        .expect(400);
      await admin("patch", `/${created.body.id}`)
        .send({ filter: { retired: true } })
        .expect(400);
      await admin("delete", `/${created.body.id}`).expect(204);
      await admin("patch", `/${created.body.id}`)
        .send({ name: "Gone" })
        .expect(404);
    });

    it("fails loudly on a stored filter the list no longer takes", async () => {
      const cohortRepo = ctx.dataSource.getRepository(WaitlistCohort);
      const stale = await cohortRepo.save({
        name: "Stale",
        filter: { retiredField: true },
      });
      await admin("get", "").expect(500);
      await admin("patch", `/${stale.id}`)
        .send({ name: "Renamed" })
        .expect(500);
      expect((await cohortRepo.findOneByOrFail({ id: stale.id })).name).toBe(
        "Stale",
      );
      await cohortRepo.delete(stale.id);
    });

    it("keeps a tag a cohort filters by, and a deleted tag out of cohorts", async () => {
      const tag = await request(server())
        .post("/waitlist/admin/tags")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Cohort tag" })
        .expect(201);
      const cohort = await admin("post", "")
        .send({ name: "Tagged cohort", filter: { tagIds: [tag.body.id] } })
        .expect(201);
      const refused = await request(server())
        .delete(`/waitlist/admin/tags/${tag.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(409);
      expect(refused.body.message).toContain("Tagged cohort");
      const unrelated = await request(server())
        .post("/waitlist/admin/tags")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Unrelated tag" })
        .expect(201);
      await request(server())
        .delete(`/waitlist/admin/tags/${unrelated.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(204);

      await admin("delete", `/${cohort.body.id}`).expect(204);
      await request(server())
        .delete(`/waitlist/admin/tags/${tag.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(204);

      const refusedSave = await admin("post", "")
        .send({ name: "Deleted tag", filter: { tagIds: [tag.body.id] } })
        .expect(400);
      expect(refusedSave.body.message).toContain(String(tag.body.id));
      const other = await admin("post", "")
        .send({ name: "Untagged", filter: {} })
        .expect(201);
      await admin("patch", `/${other.body.id}`)
        .send({ filter: { tagIds: [tag.body.id] } })
        .expect(400);
      await admin("delete", `/${other.body.id}`).expect(204);
    });
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
