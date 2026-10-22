import { NotificationChannel } from "src/notifs/notif-utils";
import { NotificationKind } from "./notification-kind";
import { Preferences, wantsKind } from "./notification-preferences.service";

const allOn = {
  inAppByDefault: true,
  pushByDefault: true,
  textByDefault: true,
  emailByDefault: true,
};
const pushOff = { ...allOn, pushByDefault: false };

describe("wantsKind", () => {
  it("follows the channel default without an override", () => {
    expect(
      wantsKind({
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Push,
        defaults: pushOff,
        override: undefined,
      }),
    ).toBe(false);
    expect(
      wantsKind({
        kind: NotificationKind.Likes,
        channel: NotificationChannel.InApp,
        defaults: pushOff,
        override: undefined,
      }),
    ).toBe(true);
  });

  it("lets an override win over the default either way", () => {
    expect(
      wantsKind({
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Push,
        defaults: pushOff,
        override: true,
      }),
    ).toBe(true);
    expect(
      wantsKind({
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Push,
        defaults: allOn,
        override: false,
      }),
    ).toBe(false);
  });

  it("ignores an override on a required kind", () => {
    expect(
      wantsKind({
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Push,
        defaults: allOn,
        override: false,
      }),
    ).toBe(true);
    expect(
      wantsKind({
        kind: NotificationKind.ContractSuspended,
        channel: NotificationChannel.Push,
        defaults: pushOff,
        override: true,
      }),
    ).toBe(false);
  });

  it("never wants a channel the kind doesn't offer", () => {
    expect(
      wantsKind({
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Text,
        defaults: allOn,
        override: true,
      }),
    ).toBe(false);
  });
});

describe("Preferences", () => {
  const preferences = new Preferences(
    new Map([
      [1, allOn],
      [2, pushOff],
    ]),
    new Map([
      [`2:${NotificationKind.Likes}:${NotificationChannel.Push}`, true],
    ]),
  );

  it("resolves each member against their own defaults and overrides", () => {
    expect(
      preferences.wants({
        userId: 1,
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Push,
      }),
    ).toBe(true);
    expect(
      preferences.wants({
        userId: 2,
        kind: NotificationKind.Likes,
        channel: NotificationChannel.Push,
      }),
    ).toBe(true);
    expect(
      preferences.wants({
        userId: 2,
        kind: NotificationKind.Messages,
        channel: NotificationChannel.Push,
      }),
    ).toBe(false);
  });

  it("wants nothing for a member it didn't load", () => {
    expect(
      preferences.wants({
        userId: 3,
        kind: NotificationKind.Likes,
        channel: NotificationChannel.InApp,
      }),
    ).toBe(false);
  });
});
