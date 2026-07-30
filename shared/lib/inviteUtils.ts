import type {
  CommunityInviteDto,
  OnetimeInviteDto,
  ShareUrlMineDto,
} from "../client";
import { automaticInviteNote, inviteDestination } from "./copy";

/**
 * A line of explanation under the destination picker. Data rather than markup
 * so web and mobile render the same words in their own primitives.
 */
export type InviteNote = { tone: "info" | "warning"; text: string };

/** What to say about where a reusable link currently sends people. */
export function reusableInviteNotes(link: ShareUrlMineDto): InviteNote[] {
  const automatic = automaticInviteReason(link);
  return [
    ...(automatic
      ? [{ tone: "info" as const, text: automaticInviteNote[automatic] }]
      : []),
    ...(inviteDestinationIsDeleted(link)
      ? [
          {
            tone: "warning" as const,
            text: inviteDestination.reusable.deletedGroup,
          },
        ]
      : []),
    { tone: "info", text: inviteDestination.reusable.retargetIsFutureOnly },
  ];
}

export const onetimeInviteNotes: InviteNote[] = [
  { tone: "info", text: inviteDestination.onetime.joinsOnSigning },
];

/** True when the link names a group that has since been deleted. */
export function inviteDestinationIsDeleted(link: ShareUrlMineDto): boolean {
  return link.assignmentKind === "community" && link.communityId === null;
}

/**
 * Where a reusable invite link places the people who sign up through it.
 *
 * `automatic` covers the primary link and links made before group selection
 * existed: they fill a group the inviter leads. `open` is the opposite choice —
 * it deliberately skips those, so the two need distinguishable labels.
 *
 * Deleting the group nulls the id but leaves the `community` kind, so that
 * pairing means the named destination is gone. Every signup through the link
 * now falls through to manual assignment, which is worth saying out loud.
 */
export function inviteDestinationLabel(link: ShareUrlMineDto): string {
  switch (link.assignmentKind) {
    case "automatic":
      return "Group: Your group";
    case "community":
      return inviteDestinationIsDeleted(link)
        ? "Group: Deleted — replace this link"
        : `Group: ${link.communityName}`;
    case "open":
      return "Group: Any open group";
    default:
      throw new Error(
        `unknown invite assignment: ${link.assignmentKind satisfies never}`,
      );
  }
}

/**
 * Why a link places people automatically, or null when it names a destination.
 *
 * Both fill whichever group the owner leads, but only one is a leftover: the
 * primary link is minted without a destination and stays that way, so calling
 * it out as predating group selection would be wrong for one made today.
 */
export type AutomaticInviteReason = "primary" | "legacy";

export function automaticInviteReason(
  link: ShareUrlMineDto,
): AutomaticInviteReason | null {
  if (link.assignmentKind !== "automatic") return null;
  return link.duplicate ? "legacy" : "primary";
}

/**
 * Which option to preselect in the destination picker. `undefined` leaves
 * nothing selected — for a link that never named a group, and for one whose
 * group is gone, since neither is any of the choices on offer.
 */
export function inviteDestinationSelection(
  link: ShareUrlMineDto,
): number | null | undefined {
  switch (link.assignmentKind) {
    case "automatic":
      return undefined;
    case "community":
      return link.communityId ?? undefined;
    case "open":
      return null;
    default:
      throw new Error(
        `unknown invite assignment: ${link.assignmentKind satisfies never}`,
      );
  }
}

/** Optional callbacks for invite list/section actions; pass a single object to simplify props. */
export type OnetimeInviteActions = {
  onApprove?: (inviteId: number) => void;
  onReject?: (inviteId: number) => void;
  onDelete?: (inviteId: number, event: unknown) => void;
  onDeleteWithConfirm?: (inviteId: number, event: unknown) => void;
  onShared?: (inviteId: number) => void;
  /** Given for invites that can still be edited; makes the whole row open settings. */
  onOpenSettings?: (inviteId: number) => void;
};

const createdAtComparator = (
  a: { createdAt: string },
  b: { createdAt: string },
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
          `Unknown invite status: ${invite.status satisfies never}`,
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

export function bucketCommunityInvitesByActionability(params: {
  invites: CommunityInviteDto[];
  userId: number;
}): {
  actionable: CommunityInviteDto[];
  waitingForResponse: CommunityInviteDto[];
  settled: CommunityInviteDto[];
} {
  const { invites, userId } = params;

  const actionable: CommunityInviteDto[] = [];
  const waitingForResponse: CommunityInviteDto[] = [];
  const settled: CommunityInviteDto[] = [];

  for (const invite of invites) {
    switch (invite.status) {
      case "cancelled":
      case "invitee_rejected":
      case "invitee_accepted":
      case "request_rejected":
        settled.push(invite);
        break;
      case "invitee_pending":
        waitingForResponse.push(invite);
        break;
      case "request_pending":
        if (invite.invitingUser?.id === userId) {
          waitingForResponse.push(invite);
        } else {
          actionable.push(invite);
        }
        break;
      default:
        throw new Error(
          `Unknown invite status: ${invite.status satisfies never}`,
        );
    }
  }

  return {
    actionable: actionable.sort(createdAtComparator),
    waitingForResponse: waitingForResponse.sort(createdAtComparator),
    settled: settled.sort(createdAtComparator),
  };
}
