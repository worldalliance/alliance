import type { FindOptionsWhere } from "typeorm";
import { Friend, FriendStatus } from "./entities/friend.entity";
import type { User } from "./entities/user.entity";

/** `acceptedFriendshipSql` states the same rule; change them together. */
export const acceptedFriendship = {
  status: FriendStatus.Accepted,
} satisfies FindOptionsWhere<Friend>;

export const acceptedFriendshipSql = (alias: string): string =>
  `(${alias}.status = '${FriendStatus.Accepted}' AND ${alias}."deletedAt" IS NULL)`;

export const acceptedFriendshipsOf = (
  userId: number,
): FindOptionsWhere<Friend>[] => [
  { requester: { id: userId }, ...acceptedFriendship },
  { addressee: { id: userId }, ...acceptedFriendship },
];

export const friendshipBetween = (userIdA: number, userIdB: number) =>
  ({
    lowUserId: Math.min(userIdA, userIdB),
    highUserId: Math.max(userIdA, userIdB),
  }) satisfies FindOptionsWhere<Friend>;

/** Needs `requester` and `addressee` loaded. */
export const friendOf = (friendship: Friend, userId: number): User =>
  friendship.requester!.id === userId
    ? friendship.addressee!
    : friendship.requester!;
