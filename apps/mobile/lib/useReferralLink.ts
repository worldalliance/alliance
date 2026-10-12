import type { UserDto } from "@alliance/shared/client";
import { getInviteLandingUrl } from "@alliance/shared/lib/inviteUrls";
import { useMemo } from "react";
import { getSiteUrl } from "./config";

/**
 * Returns the current user's referral landing link, or null if not available.
 */
export function useReferralLink(
  user: UserDto | null | undefined,
): string | null {
  return useMemo(() => {
    if (user?.referralCode == null) return null;
    return getInviteLandingUrl(getSiteUrl(), user.referralCode);
  }, [user?.referralCode]);
}
