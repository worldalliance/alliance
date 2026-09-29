import { useQuery } from "@tanstack/react-query";
import {
  userOnetimeInvite,
  userReferrerProfile,
  type OnetimeInviteStatus,
  type ReferrerProfileDto,
} from "../client";
import { queryKeys } from "./queryKeys";

export enum InviteRefusal {
  Used = "used",
  Unapproved = "unapproved",
}

export const INVITE_REFUSAL_HEADING: Record<InviteRefusal, string> = {
  [InviteRefusal.Used]: "This invite link has already been used.",
  [InviteRefusal.Unapproved]: "This invite link isn’t active.",
};

/**
 * Who the code names, and why it can't start a signup, if it can't.
 * Resolution goes through `referrerProfile` rather than the invite itself, so
 * reusable share links, campaign codes and personal referral codes all name
 * their inviter. Only a onetime invite can be refused, so `refusal` still
 * comes from that lookup.
 */
export function useInvite(referralCode: string | null) {
  const { data: referrer, isPending: referrerPending } = useQuery({
    queryKey: queryKeys.referrerProfile(referralCode),
    queryFn: () =>
      userReferrerProfile({ path: { code: referralCode! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });

  const { data: invite, isPending: invitePending } = useQuery({
    queryKey: queryKeys.onetimeInvite(referralCode),
    queryFn: () =>
      userOnetimeInvite({ path: { code: referralCode! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: Boolean(referralCode),
    retry: false,
  });

  const refusal = invite ? REFUSAL_BY_STATUS[invite.status] : null;
  const pending = Boolean(referralCode) && (invitePending || referrerPending);
  // Both lookups empty is the only proof the code names nothing. Neither
  // settles it alone: an invite whose inviter is gone has no referrer, and a
  // campaign or personal referral code has no onetime invite behind it.
  const unresolved = Boolean(referralCode) && !pending && !referrer && !invite;

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
