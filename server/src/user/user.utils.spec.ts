import { Campaign } from "src/campaign/entities/campaign.entity";
import { User } from "./entities/user.entity";
import { referralLabel, textReachable } from "./user.utils";

describe("textReachable", () => {
  const reachable = {
    phoneNumber: "+14155552671",
    phoneNumberUnsubscribed: false,
  };

  it("reaches a canonical, subscribed phone number", () => {
    expect(textReachable(reachable)).toBe(true);
  });

  it("can't reach a member without a phone number", () => {
    expect(textReachable({ ...reachable, phoneNumber: null })).toBe(false);
  });

  it("can't reach an invalid or non-canonical phone number", () => {
    for (const phoneNumber of ["not-a-phone", "15550100", "(415) 555-2671"]) {
      expect(textReachable({ ...reachable, phoneNumber })).toBe(false);
    }
  });

  it("can't reach a number that replied STOP", () => {
    expect(textReachable({ ...reachable, phoneNumberUnsubscribed: true })).toBe(
      false,
    );
  });
});

describe("referralLabel", () => {
  it("labels a user-referred signup", () => {
    expect(
      referralLabel({
        referredBy: { name: "Alice" } as User,
        referredByCampaign: null,
      }),
    ).toBe("(invited by Alice)");
  });

  it("labels a campaign-referred signup", () => {
    expect(
      referralLabel({
        referredBy: null,
        referredByCampaign: { name: "Spring Drive" } as Campaign,
      }),
    ).toBe("(via campaign Spring Drive)");
  });

  it("prefers the referring user over the campaign", () => {
    expect(
      referralLabel({
        referredBy: { name: "Alice" } as User,
        referredByCampaign: { name: "Spring Drive" } as Campaign,
      }),
    ).toBe("(invited by Alice)");
  });

  it("is empty without a referrer", () => {
    expect(referralLabel({ referredBy: null, referredByCampaign: null })).toBe(
      "",
    );
  });

  it("is empty when the referrer relation is not hydrated with a name", () => {
    expect(
      referralLabel({
        referredBy: { id: 5 } as User,
        referredByCampaign: null,
      }),
    ).toBe("");
    expect(
      referralLabel({
        referredBy: null,
        referredByCampaign: { id: 7 } as Campaign,
      }),
    ).toBe("");
  });
});
