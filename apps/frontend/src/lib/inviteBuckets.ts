import type { OnetimeInviteDto } from "@alliance/shared/client";

const createdAtComparator = (
  a: { createdAt: string },
  b: { createdAt: string }
) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export type InviteBuckets = {
  immediatelyActionable: OnetimeInviteDto[];
  requiresUnverifiableAction: OnetimeInviteDto[];
  waitingForResponse: OnetimeInviteDto[];
  settled: OnetimeInviteDto[];
};

export function bucketOnetimeInvites(
  invites: OnetimeInviteDto[],
  leaderCommunityIds: Set<number>,
  currentUserId: number | undefined
): InviteBuckets {
  const immediatelyActionable = invites
    .filter(
      (invite) =>
        invite.status === "request_pending" &&
        invite.community?.id &&
        leaderCommunityIds.has(invite.community.id)
    )
    .sort(createdAtComparator);

  const requiresUnverifiableAction = invites
    .filter((invite) => invite.status === "link_unused")
    .sort(createdAtComparator);

  const waitingForResponse = invites
    .filter(
      (invite) =>
        invite.status === "request_pending" &&
        invite.invitingUser?.id === currentUserId &&
        !(invite.community?.id && leaderCommunityIds.has(invite.community.id))
    )
    .sort(createdAtComparator);

  const settled = invites
    .filter(
      (invite) =>
        invite.status === "request_rejected" || invite.status === "link_used"
    )
    .sort(createdAtComparator);

  return {
    immediatelyActionable,
    requiresUnverifiableAction,
    waitingForResponse,
    settled,
  };
}
