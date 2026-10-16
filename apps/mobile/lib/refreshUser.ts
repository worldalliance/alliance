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
