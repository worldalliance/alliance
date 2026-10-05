import { userGetAmbassadorProgramAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useAmbassadorProgramAdmin() {
  return useQuery({
    queryKey: queryKeys.ambassadorProgramAdmin(),
    queryFn: () =>
      userGetAmbassadorProgramAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
}
