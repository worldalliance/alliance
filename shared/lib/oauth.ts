import {
  OAUTH_PROVIDER_LABEL,
  type OAuthProvider,
} from "@alliance/common/oauth";
import type { UserDto } from "../client";

/** Disconnecting a provider must leave a password or another provider behind. */
export function isLastWayIn(
  user: Pick<UserDto, "hasPassword" | "oauthAccounts">,
  provider: OAuthProvider,
): boolean {
  const accounts = user.oauthAccounts ?? [];
  return (
    !user.hasPassword &&
    accounts.length === 1 &&
    accounts[0].provider === provider
  );
}

/** Why the disconnect is refused. Settings puts a reset above it. */
export const lastWayInNotice = (provider: OAuthProvider): string =>
  `${OAUTH_PROVIDER_LABEL[provider]} is the only way into your account right now. Send yourself a reset link above to set a password first.`;
