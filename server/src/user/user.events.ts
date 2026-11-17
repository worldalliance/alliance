export const UserEvents = {
  FriendsAccepted: "user.friends.accepted",
  AccountDeleted: "user.account.deleted",
  AdminRevoked: "user.admin.revoked",
  AwayRangesChanged: "user.awayRanges.changed",
} as const;

export type UserEventName = (typeof UserEvents)[keyof typeof UserEvents];

export interface AccountDeletedPayload {
  userId: number;
}

/** Emitted after the change commits, so listeners can drop admin-only
 * connections the user still holds. */
export interface AdminRevokedPayload {
  userId: number;
}

export interface FriendsAcceptedPayload {
  userIdA: number;
  userIdB: number;
}

export interface AwayRangesChangedPayload {
  userId: number;
}
