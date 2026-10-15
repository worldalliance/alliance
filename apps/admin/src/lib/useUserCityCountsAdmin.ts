import { userCityCountsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useUserCityCountsAdmin() {
  return useQuery({
    queryKey: queryKeys.userCityCountsAdmin(),
    queryFn: () =>
      userCityCountsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}
