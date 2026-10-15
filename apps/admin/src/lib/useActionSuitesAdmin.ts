import {
  actionsCreateSuiteAdmin,
  actionsSuitesAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useActionSuitesAdmin() {
  const queryClient = useQueryClient();
  const suites = useQuery({
    queryKey: queryKeys.actionSuitesAdmin(),
    queryFn: () =>
      actionsSuitesAdmin({ throwOnError: true }).then((r) => r.data),
  });
  const createSuite = useMutation({
    mutationFn: (name: string) =>
      actionsCreateSuiteAdmin({ body: { name }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.actionSuitesAdmin(),
      }),
  });
  return { suites, createSuite };
}
