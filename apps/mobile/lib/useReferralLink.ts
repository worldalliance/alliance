import type { UserDto } from "@alliance/shared/client";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { useMemo } from "react";
import { getBaseUrl } from "./config";

/**
 * Returns the current user's referral signup link, or null if not available.
 */
export function useReferralLink(
  user: UserDto | null | undefined,
): string | null {
  return useMemo(() => {
    if (user?.referralCode == null) return null;
    return getReferralSignupUrl(getBaseUrl(), user.referralCode);
  }, [user?.referralCode]);
}
