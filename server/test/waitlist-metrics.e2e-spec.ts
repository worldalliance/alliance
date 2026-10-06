import { ActionActivityType } from "@alliance/common/actionActivity";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { Action } from "../src/actions/entities/action.entity";
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
import type { WaitlistEntryFilterDto } from "../src/waitlist/dto/waitlist-entry-admin.dto";
import { WaitlistEmailBatch } from "../src/waitlist/entities/waitlist-email-batch.entity";
import {
  WaitlistEmailRecipient,
  WaitlistEmailRecipientStatus,
} from "../src/waitlist/entities/waitlist-email-recipient.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

const HOUR = 60 * 60 * 1000;
const SENT_AT = new Date("2026-03-04T12:00:00Z");
const after = (ms: number) => new Date(SENT_AT.getTime() + ms);

describe("Waitlist metrics (e2e)", () => {
  let ctx: TestContext;
  let campaignRepo: Repository<Campaign>;
  let entryRepo: Repository<WaitlistEntry>;
  let linkRepo: Repository<WaitlistLink>;
  let inviteRepo: Repository<OnetimeInvite>;
  let userRepo: Repository<User>;

  const saveOrganization = (name: string) =>
    campaignRepo.save(
      campaignRepo.create({
        name,
        code: `org-${Math.random()}`,
        kind: CampaignKind.Organization,
      }),
    );

  const saveLink = (organization: Campaign, channel: string) =>
    linkRepo.save({
      code: `link-${Math.random()}`,
      organizationId: organization.id,
      channel,
      publishedAt: new Date("2026-02-20T00:00:00Z"),
    });

  const saveEntry = async (
    link: WaitlistLink,
    fields: Partial<WaitlistEntry> & { createdAt: Date },
  ) => {
    const entry = await entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: `person-${Math.random()}@example.com`,
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: null,
        organizationId: link.organizationId,
        sourceLinkId: link.id,
        ...fields,
      }),
    );
    await entryRepo.update(entry.id, { createdAt: fields.createdAt });
    return entry;
  };

  const saveInvite = (entry: WaitlistEntry, community: Community | null) =>
    inviteRepo.save(
      inviteRepo.create({
        invitee: entry.name,
        code: `invite-${Math.random()}`,
        status: OnetimeInviteStatus.LINK_UNUSED,
        organizationId: entry.organizationId,
        waitlistEntryId: entry.id,
        community,
      }),
    );

  const emailInvite = async (params: {
    entry: WaitlistEntry;
    invite: OnetimeInvite | null;
    status: WaitlistEmailRecipientStatus;
    acceptedAt: Date | null;
  }) => {
    const batch = await ctx.dataSource.getRepository(WaitlistEmailBatch).save({
      requestId: crypto.randomUUID(),
      subject: "Join",
      body: "#{signupLink}",
      mobilize: false,
      includeClaimed: false,
      staffUserId: null,
    });
    await ctx.dataSource.getRepository(WaitlistEmailRecipient).save({
      batchId: batch.id,
      entryId: params.entry.id,
      status: params.status,
      inviteId: params.invite?.id ?? null,
      acceptedAt: params.acceptedAt,
    });
  };

  /** Signs up through the invite, from any email, as a forwarded invite would. */
  const claim = async (invite: OnetimeInvite, claimedAt: Date) => {
    await inviteRepo.update(invite.id, {
      status: OnetimeInviteStatus.LINK_USED,
    });
    const user = await userRepo.save(
      userRepo.create({
        email: `claimant-${Math.random()}@example.com`,
        password: "password",
        name: "Claimant",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: invite,
      }),
    );
    await userRepo.update(user.id, { createdAt: claimedAt });
    return user;
  };

  const complete = async (user: User, action: Action) =>
    ctx.dataSource.getRepository(ActionActivity).save({
      userId: user.id,
      actionId: action.id,
      type: ActionActivityType.USER_COMPLETED,
    });

  const metrics = (filter: WaitlistEntryFilterDto) =>
    request(ctx.app.getHttpServer())
      .post("/waitlist/admin/entries/metrics")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ filter });

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    linkRepo = ctx.dataSource.getRepository(WaitlistLink);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects non-admins", async () => {
    await request(ctx.app.getHttpServer())
      .post("/waitlist/admin/entries/metrics")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ filter: {} })
      .expect(401);
  });

  it("counts the filtered entries' statuses, invite emails, claims, and conversions", async () => {
    const organization = await saveOrganization("Metrics Org");
    const group = await ctx.dataSource
      .getRepository(Community)
      .save({ name: `Metrics Group ${Math.random()}` });
    const newsletter = await saveLink(organization, "Newsletter");
    const social = await saveLink(organization, "Social");
    const actionRepo = ctx.dataSource.getRepository(Action);
    const onboarding = await actionRepo.save(
      actionRepo.create({
        name: "Onboarding",
        category: [],
        body: "",
        onboarding: true,
      }),
    );
    const contractSigning = await actionRepo.save(
      actionRepo.create({
        name: "Sign the contract",
        category: [],
        body: "",
        isContractSigningAction: true,
      }),
    );

    // Accepted by hand, never emailed.
    await saveEntry(newsletter, {
      createdAt: new Date("2026-02-25T12:00:00Z"),
      mobilizedAt: new Date(),
    });

    const emailed = await saveEntry(newsletter, {
      createdAt: new Date("2026-02-25T12:00:00Z"),
      mobilizedAt: SENT_AT,
    });
    const emailedInvite = await saveInvite(emailed, group);
    await emailInvite({
      entry: emailed,
      invite: emailedInvite,
      status: WaitlistEmailRecipientStatus.Sent,
      acceptedAt: SENT_AT,
    });
    const member = await claim(emailedInvite, after(2 * HOUR));
    await giveActiveContract(ctx, member.id);
    await complete(member, onboarding);

    // Its first invite was forwarded and claimed, then replaced and claimed.
    const replaced = await saveEntry(social, {
      createdAt: new Date("2026-03-03T12:00:00Z"),
      referrerId: emailed.id,
    });
    const forwardedInvite = await saveInvite(replaced, group);
    await emailInvite({
      entry: replaced,
      invite: forwardedInvite,
      status: WaitlistEmailRecipientStatus.Sent,
      acceptedAt: SENT_AT,
    });
    await claim(forwardedInvite, after(6 * HOUR));
    const replacementInvite = await saveInvite(replaced, null);
    await emailInvite({
      entry: replaced,
      invite: replacementInvite,
      status: WaitlistEmailRecipientStatus.Sent,
      acceptedAt: after(24 * HOUR),
    });
    const signer = await claim(replacementInvite, after(28 * HOUR));
    await giveActiveContract(ctx, signer.id);
    await complete(signer, contractSigning);

    // Claimed before the mail server accepted the email carrying the invite,
    // as through an earlier email left uncertain.
    const claimedEarly = await saveEntry(newsletter, {
      createdAt: new Date("2026-02-25T12:00:00Z"),
    });
    const earlyInvite = await saveInvite(claimedEarly, group);
    await claim(earlyInvite, after(-HOUR));
    await emailInvite({
      entry: claimedEarly,
      invite: earlyInvite,
      status: WaitlistEmailRecipientStatus.Sent,
      acceptedAt: SENT_AT,
    });

    // Its invite email failed, its accepted email carried no invite, and its
    // email's owner signed up through an unrelated invite, which the waitlist
    // doesn't track.
    const waitingEmail = `waiting-${Math.random()}@example.com`;
    const waiting = await saveEntry(newsletter, {
      email: waitingEmail,
      createdAt: new Date("2026-03-03T12:00:00Z"),
    });
    await emailInvite({
      entry: waiting,
      invite: await saveInvite(waiting, group),
      status: WaitlistEmailRecipientStatus.Failed,
      acceptedAt: null,
    });
    await emailInvite({
      entry: waiting,
      invite: null,
      status: WaitlistEmailRecipientStatus.Sent,
      acceptedAt: SENT_AT,
    });
    const unrelatedInvite = await inviteRepo.save(
      inviteRepo.create({
        invitee: "Unrelated",
        code: `invite-${Math.random()}`,
        status: OnetimeInviteStatus.LINK_USED,
      }),
    );
    await userRepo.save(
      userRepo.create({
        email: waitingEmail,
        password: "password",
        name: "Same Email",
        referralSource: ReferralSource.OnetimeInvite,
        referredByInvite: unrelatedInvite,
      }),
    );

    const other = await saveOrganization("Other Org");
    const otherEntry = await saveEntry(await saveLink(other, "Other"), {
      createdAt: new Date("2026-03-03T12:00:00Z"),
    });
    await claim(await saveInvite(otherEntry, null), after(HOUR));

    const res = await metrics({ organizationIds: [organization.id] }).expect(
      200,
    );

    expect(res.body.status).toEqual({
      entries: 5,
      waiting: 3,
      mobilized: 2,
      inviteClaimed: 3,
      inviteClaims: 4,
    });
    expect(res.body.inviteEmails).toEqual({
      emailed: 3,
      claimed: 3,
      timedClaims: 2,
      medianSecondsToClaim: 4 * 60 * 60,
    });
    expect(res.body.weeks).toEqual([
      { weekStart: "2026-02-23", entries: 3, claims: 0 },
      { weekStart: "2026-03-02", entries: 2, claims: 4 },
    ]);
    const orgRef = { id: organization.id, name: "Metrics Org" };
    const linkRef = (link: WaitlistLink) => ({
      id: link.id,
      channel: link.channel,
      publishedAt: "2026-02-20T00:00:00.000Z",
    });
    expect(res.body.sources).toEqual([
      {
        organization: orgRef,
        link: linkRef(newsletter),
        entries: 4,
        claims: 2,
      },
      { organization: orgRef, link: linkRef(social), entries: 1, claims: 2 },
    ]);
    expect(res.body.conversions).toEqual([
      {
        organization: orgRef,
        group: { id: group.id, name: group.name },
        claims: 3,
        contractSigned: 1,
        firstAction: 1,
      },
      {
        organization: orgRef,
        group: null,
        claims: 1,
        contractSigned: 1,
        firstAction: 0,
      },
    ]);
  });

  it("counts a submitted email once however often it is submitted", async () => {
    const organization = await saveOrganization("Duplicate Org");
    const link = await saveLink(organization, "Newsletter");
    const email = `duplicate-${Math.random()}@example.com`;
    for (const name of ["First", "Second"]) {
      await request(ctx.app.getHttpServer())
        .post("/waitlist/entries")
        .send({ name, email, committed: true, linkCode: link.code })
        .expect(200);
    }

    const res = await metrics({ organizationIds: [organization.id] }).expect(
      200,
    );

    expect(res.body.status.entries).toBe(1);
    expect(res.body.sources).toEqual([
      expect.objectContaining({ entries: 1, claims: 0 }),
    ]);
  });

  it("reports zeros, no median, and no breakdowns for an empty cohort", async () => {
    const res = await metrics({ search: `nobody-${Math.random()}` }).expect(
      200,
    );

    expect(res.body).toEqual({
      status: {
        entries: 0,
        waiting: 0,
        mobilized: 0,
        inviteClaimed: 0,
        inviteClaims: 0,
      },
      inviteEmails: {
        emailed: 0,
        claimed: 0,
        timedClaims: 0,
        medianSecondsToClaim: null,
      },
      weeks: [],
      sources: [],
      conversions: [],
    });
  });
});
