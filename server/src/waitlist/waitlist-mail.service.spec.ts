import {
  decideClaim,
  MailClaim,
  publicMailDailyCap,
} from "./waitlist-mail.service";

describe("decideClaim", () => {
  it.each([
    [{ recipientLimited: true, sentToday: 0 }, MailClaim.RecipientLimited],
    [{ recipientLimited: false, sentToday: 3 }, MailClaim.DailyCapReached],
    [{ recipientLimited: false, sentToday: 2 }, MailClaim.ClaimedLastOfDay],
    [{ recipientLimited: false, sentToday: 1 }, MailClaim.Claimed],
  ])("decides %p against a cap of 3 as %s", (counts, claim) => {
    expect(decideClaim({ ...counts, dailyCap: 3 })).toBe(claim);
  });
});

describe("publicMailDailyCap", () => {
  const saved = process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
    } else {
      process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = saved;
    }
  });

  it("is off until the cap is set", () => {
    delete process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP;
    expect(publicMailDailyCap()).toBeNull();
    process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = "500";
    expect(publicMailDailyCap()).toBe(500);
  });

  it.each(["0", "ten", "1.5"])("rejects a daily cap of %p", (cap) => {
    process.env.WAITLIST_PUBLIC_MAIL_DAILY_CAP = cap;
    expect(() => publicMailDailyCap()).toThrow(
      "WAITLIST_PUBLIC_MAIL_DAILY_CAP",
    );
  });
});
