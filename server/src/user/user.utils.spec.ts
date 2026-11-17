import { Campaign } from "src/campaign/entities/campaign.entity";
import type { Queryable } from "src/datasources/advisory-lock";
import { phoneNumberTransformer } from "src/utils/phone";
import { User } from "./entities/user.entity";
import {
  hasPassword,
  loadedUserTags,
  lockPhoneNumber,
  memberWithReferral,
  referralLabel,
  textReachable,
} from "./user.utils";

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

describe("memberWithReferral", () => {
  it("follows the name with the referral label", () => {
    expect(
      memberWithReferral({
        name: "Bob",
        referredBy: { name: "Alice" } as User,
        referredByCampaign: null,
      }),
    ).toBe("Bob (invited by Alice)");
  });

  it("is the bare name without a referrer", () => {
    expect(
      memberWithReferral({
        name: "Bob",
        referredBy: null,
        referredByCampaign: null,
      }),
    ).toBe("Bob");
  });
});

describe("hasPassword", () => {
  it.each([
    { password: "hunter2", expected: true },
    { password: "", expected: false },
    { password: null, expected: false },
  ])("is $expected for password $password", ({ password, expected }) => {
    expect(hasPassword({ password })).toBe(expected);
  });
});

describe("loadedUserTags", () => {
  it("returns the loaded tags", () => {
    expect(loadedUserTags({ id: 3, tags: [] })).toEqual([]);
  });

  it("throws when the tags aren't loaded", () => {
    expect(() => loadedUserTags({ id: 3, tags: undefined })).toThrow(
      "tags of user 3 not loaded",
    );
  });
});

describe("lockPhoneNumber", () => {
  it("locks a number as the column stores it", async () => {
    const keys: unknown[] = [];
    const em: Queryable = {
      queryRunner: { isTransactionActive: true },
      query: async (_sql, parameters) => keys.push(...parameters),
    };
    const formats = ["+1 (415) 555-2671", "(415) 555-2671", "+14155552671"];
    for (const phoneNumber of formats) {
      await lockPhoneNumber(em, phoneNumber);
    }
    expect(keys).toEqual(
      formats.map((n) => `phone-number:${phoneNumberTransformer.to(n)}`),
    );
  });
});
