import { NotificationChannel } from "src/notifs/notif-utils";
import { externalChannels, type ExternalRecipient } from "./external-channels";
import { NotificationKind } from "./notification-kind";
import { Preferences } from "./notification-preferences.service";

const allOn = {
  inAppByDefault: true,
  pushByDefault: true,
  textByDefault: true,
  emailByDefault: true,
};

const reachable: ExternalRecipient = {
  id: 1,
  hasActiveContract: true,
  phoneNumber: "+14155552671",
  phoneNumberUnsubscribed: false,
};

const channels = (
  user: Partial<ExternalRecipient>,
  overrides: [NotificationChannel, boolean][] = [],
) =>
  externalChannels({
    user: { ...reachable, ...user },
    kind: NotificationKind.ActionReminders,
    preferences: new Preferences(
      new Map([[1, allOn]]),
      new Map(
        overrides.map(([channel, enabled]) => [
          `1:${NotificationKind.ActionReminders}:${channel}`,
          enabled,
        ]),
      ),
    ),
  });

describe("externalChannels", () => {
  it("lists every channel a reachable member wants", () => {
    expect(channels({})).toEqual([
      NotificationChannel.Push,
      NotificationChannel.Text,
      NotificationChannel.Email,
    ]);
  });

  it("omits channels the member turned off for the kind", () => {
    expect(
      channels({}, [
        [NotificationChannel.Push, false],
        [NotificationChannel.Email, false],
      ]),
    ).toEqual([NotificationChannel.Text]);
  });

  it("texts only a valid number that hasn't replied STOP", () => {
    expect(channels({ phoneNumber: null })).not.toContain(
      NotificationChannel.Text,
    );
    expect(channels({ phoneNumber: "4155552671" })).not.toContain(
      NotificationChannel.Text,
    );
    expect(channels({ phoneNumberUnsubscribed: true })).not.toContain(
      NotificationChannel.Text,
    );
  });

  it("texts and emails only members with an active agreement", () => {
    expect(channels({ hasActiveContract: false })).toEqual([
      NotificationChannel.Push,
    ]);
  });
});
