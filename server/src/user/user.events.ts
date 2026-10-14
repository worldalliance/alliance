export const UserEvents = {
  FriendsAccepted: "user.friends.accepted",
  AccountDeleted: "user.account.deleted",
  AwayRangesChanged: "user.awayRanges.changed",
} as const;

export type UserEventName = (typeof UserEvents)[keyof typeof UserEvents];

export interface AccountDeletedPayload {
  userId: number;
}

export interface FriendsAcceptedPayload {
  userIdA: number;
  userIdB: number;
}

export interface AwayRangesChangedPayload {
  userId: number;
}
