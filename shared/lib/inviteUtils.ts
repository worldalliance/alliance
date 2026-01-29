import { OnetimeInviteDto } from "../client";

const createdAtComparator = (
  a: { createdAt: string },
  b: { createdAt: string }
) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export function bucketOnetimeInvitesByActionability(params: {
  invites: OnetimeInviteDto[];
  leaderCommunityIds: Set<number>;
  userId: number;
}): {
  actionable: OnetimeInviteDto[];
  unverifiableActionable: OnetimeInviteDto[];
  waitingForResponse: OnetimeInviteDto[];
  settled: OnetimeInviteDto[];
} {
  const { invites, leaderCommunityIds, userId } = params;

  const actionable: OnetimeInviteDto[] = [];
  const unverifiableActionable: OnetimeInviteDto[] = [];
  const waitingForResponse: OnetimeInviteDto[] = [];
  const settled: OnetimeInviteDto[] = [];

  for (const invite of invites) {
    switch (invite.status) {
      case "link_used":
      case "request_rejected":
        settled.push(invite);
        break;
      case "request_pending":
        if (
          invite.community?.id &&
          leaderCommunityIds.has(invite.community.id)
        ) {
          actionable.push(invite);
        } else {
          waitingForResponse.push(invite);
        }
        break;
      case "link_unused":
        if (invite.invitingUser?.id === userId) {
          unverifiableActionable.push(invite);
        } else {
          waitingForResponse.push(invite);
        }
        break;
      default:
        throw new Error(
          `Unknown invite status: ${invite.status satisfies never}`
        );
    }
  }

  return {
    actionable: actionable.sort(createdAtComparator),
    unverifiableActionable: unverifiableActionable.sort(createdAtComparator),
    waitingForResponse: waitingForResponse.sort(createdAtComparator),
    settled: settled.sort(createdAtComparator),
  };
}
