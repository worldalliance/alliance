import { userListAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useUsersAdmin(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  return useQuery({
    queryKey: queryKeys.usersAdmin(),
    queryFn: () =>
      userListAdmin({ throwOnError: true }).then((response) => response.data),
    enabled,
  });
}
