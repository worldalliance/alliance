import request from "supertest";
import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import { Community } from "../src/community/entities/community.entity";
import { MailService } from "../src/mail/mail.service";
import { OnetimeInvite } from "../src/user/entities/onetime-invite.entity";
import { WaitlistInvitePlacement } from "../src/waitlist/dto/waitlist-entry-admin.dto";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistInviteService } from "../src/waitlist/waitlist-invite.service";
import { WaitlistModule } from "../src/waitlist/waitlist.module";
import { createTestApp, TestContext, waitForLockWait } from "./e2e-test-utils";

describe("Waitlist entry invite (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let inviteRepo: Repository<OnetimeInvite>;
  let sendStaff: jest.SpyInstance;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const saveEntry = (fields: Partial<WaitlistEntry> = {}) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: `invite-${Math.random()}@example.com`,
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: "I want to help",
        ...fields,
      }),
    );

  const issueInvite = (entryId: number) =>
    asAdmin(
      request(server()).post(`/waitlist/admin/entries/${entryId}/invite`),
    );

  beforeAll(async () => {
    ctx = await createTestApp([WaitlistModule]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    sendStaff = jest.spyOn(ctx.app.get(MailService), "sendWaitlistStaffEmail");
  }, 50000);

  beforeEach(() => {
    sendStaff.mockClear();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("issues one invite for an entry, reusing it, and sends nothing", async () => {
    const entry = await saveEntry();

    const first = await issueInvite(entry.id).expect(200);
    const second = await issueInvite(entry.id).expect(200);

    const invites = await inviteRepo.findBy({ waitlistEntryId: entry.id });
    expect(invites).toHaveLength(1);
    expect([first.body, second.body]).toEqual([
      {
        code: invites[0].code,
        issued: true,
        placement: WaitlistInvitePlacement.NoOrganization,
      },
      {
        code: invites[0].code,
        issued: false,
        placement: WaitlistInvitePlacement.NoOrganization,
      },
    ]);
    expect(sendStaff).not.toHaveBeenCalled();
    expect(
      (await entryRepo.findOneByOrFail({ id: entry.id })).mobilizedAt,
    ).toBeNull();
  });

  it("reports the group the invite places the entrant in", async () => {
    const saveGroup = (maxCapacity: number) =>
      ctx.dataSource.getRepository(Community).save({
        name: `Group ${Math.random()}`,
        maxCapacity,
        users: [{ id: ctx.adminUserId }],
      });
    const fullGroup = await saveGroup(1);
    const openGroup = await saveGroup(5);
    const campaignRepo = ctx.dataSource.getRepository(Campaign);
    const organization = await campaignRepo.save({
      name: "Placed Org",
      code: `org-${Math.random()}`,
      kind: CampaignKind.Organization,
      communityId: fullGroup.id,
    });
    const entry = await saveEntry({ organizationId: organization.id });

    const issued = await issueInvite(entry.id).expect(200);
    expect(issued.body).toMatchObject({
      issued: true,
      placement: WaitlistInvitePlacement.FullGroup,
    });

    await campaignRepo.update(organization.id, { communityId: openGroup.id });
    const reused = await issueInvite(entry.id).expect(200);
    expect(reused.body).toMatchObject({
      issued: false,
      placement: WaitlistInvitePlacement.FullGroup,
    });
    const other = await saveEntry({ organizationId: organization.id });
    const fresh = await issueInvite(other.id).expect(200);
    expect(fresh.body).toMatchObject({
      issued: true,
      placement: WaitlistInvitePlacement.Group,
    });
  });

  it("waits for an email issuing the entry's invite, then reuses it", async () => {
    const entry = await saveEntry();
    const runner = ctx.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const emailed = await ctx.app
        .get(WaitlistInviteService)
        .inviteFor(runner.manager, entry);
      const manual = issueInvite(entry.id).then((res) => res);
      await waitForLockWait(ctx.dataSource);
      await runner.commitTransaction();
      expect((await manual).body).toMatchObject({
        code: emailed.invite.code,
        issued: false,
      });
    } finally {
      await runner.release();
    }
    expect(await inviteRepo.countBy({ waitlistEntryId: entry.id })).toBe(1);
  });

  it("issues a new invite once the old one is revoked", async () => {
    const entry = await saveEntry();
    const first = await issueInvite(entry.id).expect(200);
    await asAdmin(
      request(server()).post("/waitlist/admin/entries/revoke-invites"),
    )
      .send({ entryIds: [entry.id] })
      .expect(200);

    const second = await issueInvite(entry.id).expect(200);
    expect(second.body.code).not.toBe(first.body.code);
    expect(second.body.issued).toBe(true);
  });

  it("refuses an unknown entry and an unauthenticated caller", async () => {
    const entry = await saveEntry();
    await issueInvite(999_999_999).expect(404);
    await request(server())
      .post(`/waitlist/admin/entries/${entry.id}/invite`)
      .expect(401);
  });
});
