import { NotificationChannel } from "src/notifs/notif-utils";
import type { User } from "src/user/entities/user.entity";
import { textReachable } from "src/user/user.utils";
import type { NotificationKind } from "./notification-kind";
import type { Preferences } from "./notification-preferences.service";

export type ExternalRecipient = Pick<
  User,
  "id" | "hasActiveContract" | "phoneNumber" | "phoneNumberUnsubscribed"
>;

/**
 * The push, text, and email a member wants for `kind` and can be reached on,
 * in send order. Text and email need an active agreement.
 */
export function externalChannels(params: {
  user: ExternalRecipient;
  kind: NotificationKind;
  preferences: Preferences;
}): NotificationChannel[] {
  const { user, kind, preferences } = params;
  const wants = (channel: NotificationChannel) =>
    preferences.wants({ userId: user.id, kind, channel });
  return [
    ...(wants(NotificationChannel.Push) ? [NotificationChannel.Push] : []),
    ...(wants(NotificationChannel.Text) &&
    user.hasActiveContract &&
    textReachable(user)
      ? [NotificationChannel.Text]
      : []),
    ...(wants(NotificationChannel.Email) && user.hasActiveContract
      ? [NotificationChannel.Email]
      : []),
  ];
}
