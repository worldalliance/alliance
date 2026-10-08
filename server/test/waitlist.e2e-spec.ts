import request from "supertest";
import type { Repository } from "typeorm";
import { WaitlistReasonOptional1791422971421 } from "../migrations/1791422971421-WaitlistReasonOptional";
import { OptionalWaitlistSignupFields1791481267826 } from "../migrations/1791481267826-OptionalWaitlistSignupFields";
import { SignUpDto } from "../src/auth/dto/sign-up.dto";
import { TokenMode } from "../src/auth/dto/signin.dto";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { User } from "../src/user/entities/user.entity";
import { WaitlistEntry } from "../src/waitlist/entities/waitlist-entry.entity";
import { WaitlistLink } from "../src/waitlist/entities/waitlist-link.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Waitlist records (e2e)", () => {
  let ctx: TestContext;
  let entryRepo: Repository<WaitlistEntry>;
  let organization: Campaign;
  let link: WaitlistLink;

  const saveEntry = (fields: Partial<WaitlistEntry>) =>
    entryRepo.save(
      entryRepo.create({
        name: "Test Person",
        email: `person-${Math.random()}@example.com`,
        code: `code-${Math.random()}`,
        committedAt: new Date(),
        reason: null,
        organizationId: null,
        ...fields,
      }),
    );

  beforeAll(async () => {
    ctx = await createTestApp([]);
    entryRepo = ctx.dataSource.getRepository(WaitlistEntry);
    organization = await ctx.dataSource.getRepository(Campaign).save({
      name: "Test Org",
      code: "test-org",
      kind: CampaignKind.Organization,
    });
    link = await ctx.dataSource.getRepository(WaitlistLink).save({
      code: "test-org-newsletter",
      organizationId: organization.id,
      channel: "Newsletter",
    });
  }, 50000);

  it("migrates existing entries while allowing omitted signup fields", async () => {
    const existing = await saveEntry({ reason: "Existing reason" });
    const runner = ctx.dataSource.createQueryRunner();
    try {
      await runner.query(
        `ALTER TABLE "waitlist_entry" ALTER COLUMN "committedAt" SET NOT NULL`,
      );
      await runner.query(
        `ALTER TABLE "waitlist_entry" ADD CONSTRAINT "CHK_waitlist_entry_reason" CHECK ("organizationId" IS NOT NULL OR coalesce("reason", '') ~ '[^[:space:]]')`,
      );
      await new WaitlistReasonOptional1791422971421().up(runner);
      await new OptionalWaitlistSignupFields1791481267826().up(runner);
      const preserved = await entryRepo.findOneByOrFail({ id: existing.id });
      expect(preserved.reason).toBe(existing.reason);
      expect(preserved.committedAt).toEqual(existing.committedAt);
      const added = await saveEntry({ committedAt: null });
      expect(added.reason).toBeNull();
      expect(added.committedAt).toBeNull();
    } finally {
      await runner.release();
    }
  });

  it("allows absent and blank reasons without an organization", async () => {
    await saveEntry({});
    await saveEntry({ reason: "" });
    await saveEntry({ reason: " \t\n" });
    await saveEntry({ reason: "I want to help" });
    await saveEntry({ organizationId: organization.id });
  });

  it("keeps one entry per email, ignoring case", async () => {
    await saveEntry({ email: "same@example.com", reason: "First" });
    await expect(
      saveEntry({ email: "Same@Example.com", reason: "Second" }),
    ).rejects.toThrow(/unique/i);
  });

  it.each([" spaced@example.com", "tabbed@example.com\t"])(
    "refuses the untrimmed email %p",
    async (email) => {
      await expect(saveEntry({ email, reason: "Untrimmed" })).rejects.toThrow(
        /CHK_waitlist_entry_email_trimmed/,
      );
    },
  );

  it("records the source link and referrer of a referral", async () => {
    const referrer = await saveEntry({
      organizationId: organization.id,
      sourceLinkId: link.id,
    });
    const referred = await saveEntry({
      organizationId: organization.id,
      sourceLinkId: link.id,
      referrerId: referrer.id,
    });
    const row = await entryRepo.findOneOrFail({
      where: { id: referred.id },
      relations: { referrer: true, sourceLink: true, organization: true },
    });
    expect(row.referrer?.id).toBe(referrer.id);
    expect(row.sourceLink?.channel).toBe("Newsletter");
    expect(row.organization?.id).toBe(organization.id);
  });

  it("lets an account claim an organization's invite to a waitlist entry", async () => {
    const inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    const entry = await saveEntry({ organizationId: organization.id });
    const invite = await inviteRepo.save(
      inviteRepo.create({
        invitee: entry.name,
        code: "ORGANIZATION-INVITE",
        status: OnetimeInviteStatus.LINK_UNUSED,
        organizationId: organization.id,
        waitlistEntryId: entry.id,
      }),
    );

    await request(ctx.app.getHttpServer())
      .post("/auth/register")
      .send({
        email: "forwarded@example.com",
        password: "password",
        name: "Claimant",
        referralCode: invite.code,
        mode: TokenMode.Header,
        timeZone: "America/Los_Angeles",
      } satisfies SignUpDto)
      .expect(201);

    const user = await ctx.dataSource.getRepository(User).findOneOrFail({
      where: { email: "forwarded@example.com" },
      relations: {
        referredByInvite: { organization: true, waitlistEntry: true },
      },
    });
    expect(user.referredByInvite?.organization?.id).toBe(organization.id);
    expect(user.referredByInvite?.waitlistEntry?.id).toBe(entry.id);
  });

  it("refuses an invite issued by both a user and an organization", async () => {
    const inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    const userRepo = ctx.dataSource.getRepository(User);
    const invitingUser = await userRepo.save(
      userRepo.create({
        email: "issuer@example.com",
        password: "password",
        name: "Issuer",
      }),
    );
    await expect(
      inviteRepo.save(
        inviteRepo.create({
          invitee: "Both",
          code: "BOTH-ISSUERS",
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser,
          organizationId: organization.id,
        }),
      ),
    ).rejects.toThrow(/CHK_onetime_invite_issuer/);
  });
});
