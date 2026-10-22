import { actionsGetWelcomeQueueAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useWelcomeQueueAdmin() {
  return useQuery({
    queryKey: queryKeys.welcomeQueueAdmin(),
    queryFn: () =>
      actionsGetWelcomeQueueAdmin({ throwOnError: true }).then((r) => r.data),
  });
}
