import { Campaign } from "src/campaign/entities/campaign.entity";
import { User } from "./entities/user.entity";
import {
  referralLabel,
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from "./user.utils";

type EmailUser = Parameters<typeof userActionNotifsEnabled_email>[0];
type TextUser = Parameters<typeof userActionNotifsEnabled_text>[0];
type PushUser = Parameters<typeof userActionNotifsEnabled_push>[0];

function emailUser(overrides: Partial<EmailUser> = {}): EmailUser {
  return {
    emailNotifsForActions: true,
    turnedOffAllNotifs: false,
    hasActiveContract: true,
    ...overrides,
  };
}

function textUser(overrides: Partial<TextUser> = {}): TextUser {
  return {
    textNotifsForActions: true,
    turnedOffAllNotifs: false,
    phoneNumber: "+14155552671",
    hasActiveContract: true,
    phoneNumberUnsubscribed: false,
    ...overrides,
  };
}

function pushUser(overrides: Partial<PushUser> = {}): PushUser {
  return {
    turnedOffAllNotifs: false,
    pushNotifsForActions: true,
    ...overrides,
  };
}

describe("userActionNotifsEnabled_email", () => {
  it("is enabled when opted in with an active contract", () => {
    expect(userActionNotifsEnabled_email(emailUser())).toBe(true);
  });

  it("is disabled when email notifs for actions are off", () => {
    expect(
      userActionNotifsEnabled_email(
        emailUser({ emailNotifsForActions: false }),
      ),
    ).toBe(false);
  });

  it("is disabled when all notifs are turned off", () => {
    expect(
      userActionNotifsEnabled_email(emailUser({ turnedOffAllNotifs: true })),
    ).toBe(false);
  });

  it("is disabled without an active contract", () => {
    expect(
      userActionNotifsEnabled_email(emailUser({ hasActiveContract: false })),
    ).toBe(false);
  });
});

describe("userActionNotifsEnabled_text", () => {
  it("is enabled when opted in with a canonical, subscribed phone and active contract", () => {
    expect(userActionNotifsEnabled_text(textUser())).toBe(true);
  });

  it("is disabled when text notifs for actions are off", () => {
    expect(
      userActionNotifsEnabled_text(textUser({ textNotifsForActions: false })),
    ).toBe(false);
  });

  it("is disabled when all notifs are turned off", () => {
    expect(
      userActionNotifsEnabled_text(textUser({ turnedOffAllNotifs: true })),
    ).toBe(false);
  });

  it("is disabled without a phone number", () => {
    expect(userActionNotifsEnabled_text(textUser({ phoneNumber: null }))).toBe(
      false,
    );
  });

  it("is disabled without an active contract", () => {
    expect(
      userActionNotifsEnabled_text(textUser({ hasActiveContract: false })),
    ).toBe(false);
  });

  it("is disabled when the phone number is invalid or not canonical", () => {
    for (const phoneNumber of ["not-a-phone", "15550100", "(415) 555-2671"]) {
      expect(userActionNotifsEnabled_text(textUser({ phoneNumber }))).toBe(
        false,
      );
    }
  });

  it("is disabled when the phone number is unsubscribed", () => {
    expect(
      userActionNotifsEnabled_text(textUser({ phoneNumberUnsubscribed: true })),
    ).toBe(false);
  });
});

describe("userActionNotifsEnabled_push", () => {
  it("is enabled when opted in", () => {
    expect(userActionNotifsEnabled_push(pushUser())).toBe(true);
  });

  it("is disabled when push notifs for actions are off", () => {
    expect(
      userActionNotifsEnabled_push(pushUser({ pushNotifsForActions: false })),
    ).toBe(false);
  });

  it("is disabled when all notifs are turned off", () => {
    expect(
      userActionNotifsEnabled_push(pushUser({ turnedOffAllNotifs: true })),
    ).toBe(false);
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
