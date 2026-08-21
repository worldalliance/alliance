import { StoredInviteAssignmentKind } from "./invite-assignment-kind";

export { StoredInviteAssignmentKind };

/**
 * Where an invite places the people who arrive through it, as the `share_url`
 * and `user` tables both record it.
 *
 * A `community` target may have lost its group — deleting the group nulls the
 * id — which is distinct from carrying no assignment at all (a null
 * {@link InviteAssignmentColumns.inviteAssignmentKind}): it means the invite
 * named a destination and that destination is gone.
 */
export type StoredInviteAssignment =
  | {
      kind: StoredInviteAssignmentKind.Community;
      communityId: number | null;
    }
  | { kind: StoredInviteAssignmentKind.Open };

export enum InviteAssignmentKind {
  Automatic = "automatic",
  Community = "community",
  Open = "open",
}

/**
 * The invite assignment columns, carried identically by `share_url` (where the
 * owner's choice lives) and by `user` (the copy taken at registration, so
 * placement survives deletion of the link).
 */
export type InviteAssignmentColumns = {
  inviteAssignmentKind: StoredInviteAssignmentKind | null;
  inviteAssignmentCommunityId: number | null;
};

export function inviteAssignmentColumns(
  assignment: StoredInviteAssignment | null,
): InviteAssignmentColumns {
  if (assignment === null) {
    return { inviteAssignmentKind: null, inviteAssignmentCommunityId: null };
  }
  switch (assignment.kind) {
    case StoredInviteAssignmentKind.Community:
      return {
        inviteAssignmentKind: assignment.kind,
        inviteAssignmentCommunityId: assignment.communityId,
      };
    case StoredInviteAssignmentKind.Open:
      return {
        inviteAssignmentKind: assignment.kind,
        inviteAssignmentCommunityId: null,
      };
    default:
      throw new Error(
        `unknown invite assignment: ${assignment satisfies never}`,
      );
  }
}

export function inviteAssignmentFromColumns(
  columns: InviteAssignmentColumns,
): StoredInviteAssignment | null {
  const { inviteAssignmentKind: kind, inviteAssignmentCommunityId } = columns;
  if (kind === null) return null;
  switch (kind) {
    case StoredInviteAssignmentKind.Community:
      return { kind, communityId: inviteAssignmentCommunityId };
    case StoredInviteAssignmentKind.Open:
      return { kind };
    default:
      throw new Error(
        `unknown invite assignment kind: ${kind satisfies never}`,
      );
  }
}
