import { userStaffDirectoryAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useStaffDirectoryAdmin() {
  return useQuery({
    queryKey: queryKeys.staffDirectoryAdmin(),
    queryFn: () =>
      userStaffDirectoryAdmin({ throwOnError: true }).then((r) => r.data),
  });
}
