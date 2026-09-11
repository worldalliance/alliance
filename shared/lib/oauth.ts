import type { UserDto } from "../client";

/** Disconnecting a provider must leave a password or another provider behind. */
export function isLastWayIn(user: UserDto): boolean {
  return !user.hasPassword && (user.oauthAccounts?.length ?? 0) <= 1;
}
