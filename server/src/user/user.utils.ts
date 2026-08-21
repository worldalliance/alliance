import { isCanonicalE164 } from "@alliance/common/phone";
import { User } from "./entities/user.entity";

export function userActionNotifsEnabled_email(
  user: Pick<
    User,
    "emailNotifsForActions" | "turnedOffAllNotifs" | "hasActiveContract"
  >,
): boolean {
  return (
    user.emailNotifsForActions &&
    !user.turnedOffAllNotifs &&
    user.hasActiveContract
  );
}

export function userActionNotifsEnabled_text(
  user: Pick<
    User,
    | "textNotifsForActions"
    | "turnedOffAllNotifs"
    | "phoneNumber"
    | "hasActiveContract"
    | "phoneNumberUnsubscribed"
  >,
): boolean {
  return Boolean(
    user.textNotifsForActions &&
    !user.turnedOffAllNotifs &&
    user.phoneNumber !== null &&
    isCanonicalE164(user.phoneNumber) &&
    user.hasActiveContract &&
    !user.phoneNumberUnsubscribed,
  );
}

export function userActionNotifsEnabled_push(
  user: Pick<User, "turnedOffAllNotifs" | "pushNotifsForActions">,
): boolean {
  return !user.turnedOffAllNotifs && user.pushNotifsForActions;
}

export function referralLabel(
  user: Pick<User, "referredBy" | "referredByCampaign">,
): string {
  if (user.referredBy?.name) {
    return `(invited by ${user.referredBy.name})`;
  }
  if (user.referredByCampaign?.name) {
    return `(via campaign ${user.referredByCampaign.name})`;
  }
  return "";
}
