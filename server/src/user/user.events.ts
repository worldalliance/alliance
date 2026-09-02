export const UserEvents = {
  FriendsAccepted: "user.friends.accepted",
  OnetimeInviteCreated: "user.onetime-invite.created",
} as const;

export type UserEventName = (typeof UserEvents)[keyof typeof UserEvents];

export interface FriendsAcceptedPayload {
  userIdA: number;
  userIdB: number;
}

export interface OnetimeInviteCreatedPayload {
  inviteId: number;
}
