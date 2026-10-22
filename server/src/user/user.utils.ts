import { isCanonicalE164 } from "@alliance/common/phone";
import { User } from "./entities/user.entity";

/** Whether a text can reach the member, whatever they prefer. */
export function textReachable(
  user: Pick<User, "phoneNumber" | "phoneNumberUnsubscribed">,
): user is typeof user & { phoneNumber: string } {
  return (
    user.phoneNumber !== null &&
    isCanonicalE164(user.phoneNumber) &&
    !user.phoneNumberUnsubscribed
  );
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
