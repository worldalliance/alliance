import {
  type ClusterAdminDto,
  clusterListAdmin,
  clusterUpdateAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useClustersAdmin() {
  return useQuery({
    queryKey: queryKeys.clustersAdmin(),
    queryFn: () => clusterListAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

export function useRenameClusterAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; displayName: string }) =>
      clusterUpdateAdmin({
        path: { id: input.id },
        body: { displayName: input.displayName },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: async (updated) => {
      const queryKey = queryKeys.clustersAdmin();
      // A refetch in flight would land the old name back over the rename.
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ClusterAdminDto[]>(queryKey, (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      );
      onSuccess();
    },
    onError,
  });
}
