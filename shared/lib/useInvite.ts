import { useQuery } from "@tanstack/react-query";
import {
  userOnetimeInvite,
  userReferrerProfile,
  type OnetimeInviteStatus,
  type ReferrerProfileDto,
} from "../client";
import { queryKeys } from "./queryKeys";
import { isRefused } from "./retryQuery";

export enum InviteRefusal {
  Used = "used",
  Unapproved = "unapproved",
}

export const INVITE_REFUSAL_HEADING: Record<InviteRefusal, string> = {
  [InviteRefusal.Used]: "This invite link has already been used.",
  [InviteRefusal.Unapproved]: "This invite link isn’t active.",
};

const nullIfRefused = <T>(lookup: Promise<{ data: T }>): Promise<T | null> =>
  lookup.then(
    (res) => res.data,
    (error: unknown) => {
      if (isRefused(error)) return null;
      throw error;
    },
  );

/**
 * Who the code names, and why it can't start a signup, if it can't.
 * Resolution goes through `referrerProfile` rather than the invite itself, so
 * reusable share links, campaign codes and personal referral codes all name
 * their inviter. Only a onetime invite can be refused, so `refusal` still
 * comes from that lookup.
 */
export function useInvite(referralCode: string | null) {
  const referrerQuery = useQuery({
    queryKey: queryKeys.referrerProfile(referralCode),
    queryFn: () =>
      nullIfRefused(
        userReferrerProfile({
          path: { code: referralCode! },
          throwOnError: true,
        }),
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });
  const referrer = referrerQuery.data;

  const inviteQuery = useQuery({
    queryKey: queryKeys.onetimeInvite(referralCode),
    queryFn: () =>
      nullIfRefused(
        userOnetimeInvite({
          path: { code: referralCode! },
          throwOnError: true,
        }),
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });
  const invite = inviteQuery.data;

  const refusal = invite ? REFUSAL_BY_STATUS[invite.status] : null;
  const pending =
    Boolean(referralCode) && (inviteQuery.isPending || referrerQuery.isPending);
  // A failed refetch keeps the answer it had; only a lookup with none fails.
  const failed =
    (inviteQuery.isError && invite === undefined) ||
    (referrerQuery.isError && referrer === undefined);
  // Both lookups empty is the only proof the code names nothing. Neither
  // settles it alone: an invite whose inviter is gone has no referrer, and a
  // campaign or personal referral code has no onetime invite behind it.
  const unresolved =
    Boolean(referralCode) && !pending && !failed && !referrer && !invite;

  return {
    refusal,
    pending,
    unresolved,
    inviter: refusal ? null : namedInviter(referrer ?? null),
  };
}

const REFUSAL_BY_STATUS: Record<OnetimeInviteStatus, InviteRefusal | null> = {
  request_pending: InviteRefusal.Unapproved,
  request_rejected: InviteRefusal.Unapproved,
  link_unused: null,
  link_used: InviteRefusal.Used,
};

/** A campaign signs nothing and invites nobody by name, so it gets no line. */
export function namedInviter(
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
