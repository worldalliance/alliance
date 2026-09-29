import type { Repository } from "typeorm";
import {
  Campaign,
  CampaignKind,
} from "../src/campaign/entities/campaign.entity";
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

  it("requires a reason only without an organization", async () => {
    await expect(saveEntry({})).rejects.toThrow(/CHK_waitlist_entry_reason/);
    await expect(saveEntry({ reason: " \t\n" })).rejects.toThrow(
      /CHK_waitlist_entry_reason/,
    );
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
});
