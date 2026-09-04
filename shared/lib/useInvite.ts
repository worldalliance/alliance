import { useQuery } from "@tanstack/react-query";
import {
  userOnetimeInvite,
  userReferrerProfile,
  type ReferrerProfileDto,
} from "../client";
import { queryKeys } from "./queryKeys";

/**
 * Who the code names, and whether it is spent. Resolution goes through
 * `referrerProfile` rather than the invite itself, so reusable share links,
 * campaign codes and personal referral codes all name their inviter. Only a
 * onetime invite can be used up, so `used` still comes from that lookup.
 */
export function useInvite(referralCode: string | null) {
  const { data: referrer } = useQuery({
    queryKey: queryKeys.referrerProfile(referralCode),
    queryFn: () =>
      userReferrerProfile({ path: { code: referralCode! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });

  const { data: invite } = useQuery({
    queryKey: queryKeys.onetimeInvite(referralCode),
    queryFn: () =>
      userOnetimeInvite({ path: { code: referralCode! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });

  const used = invite?.status === "link_used";

  return { used, inviter: used ? null : namedInviter(referrer ?? null) };
}

/** A campaign signs nothing and invites nobody by name, so it gets no line. */
function namedInviter(
  referrer: ReferrerProfileDto | null,
): ReferrerProfileDto | null {
  if (!referrer) return null;
  switch (referrer.kind) {
    case "user":
      return referrer;
    case "campaign":
      return null;
    default:
      throw new Error(
        `unknown referrer kind: ${referrer.kind satisfies never}`,
      );
  }
}
