import { actionsSuitesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useActionSuitesAdmin() {
  const suites = useQuery({
    queryKey: queryKeys.actionSuitesAdmin(),
    queryFn: () =>
      actionsSuitesAdmin({ throwOnError: true }).then((r) => r.data),
  });
  return { suites };
}
