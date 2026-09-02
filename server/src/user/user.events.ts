export const UserEvents = {
  FriendsAccepted: "user.friends.accepted",
} as const;

export type UserEventName = (typeof UserEvents)[keyof typeof UserEvents];

export interface FriendsAcceptedPayload {
  userIdA: number;
  userIdB: number;
}
