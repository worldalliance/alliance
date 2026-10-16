// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { authMe, type UserDto } from "@alliance/shared/client";

export async function refreshUser(
  setUser: (user: UserDto) => void,
): Promise<void> {
  try {
    const user = (await authMe()).data?.user;
    if (user) setUser(user);
  } catch {
    // Leave current user on transient failure; session refresh handles auth.
  }
}
