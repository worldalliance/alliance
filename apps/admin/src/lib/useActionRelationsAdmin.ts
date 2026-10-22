import { actionsActionRelationsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useActionRelationsAdmin() {
  return useQuery({
    queryKey: queryKeys.actionRelationsAdmin(),
    queryFn: () =>
      actionsActionRelationsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
}
