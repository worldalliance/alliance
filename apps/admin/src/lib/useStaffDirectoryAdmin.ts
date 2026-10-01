import {
  type StaffDirectoryEntryDto,
  userStaffDirectoryAdmin,
  userUpdateStaffDirectoryAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useStaffDirectoryAdmin() {
  return useQuery({
    queryKey: queryKeys.staffDirectoryAdmin(),
    queryFn: () =>
      userStaffDirectoryAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

/** Saves rows in their given order, then caches the saved directory. */
export function useSaveStaffDirectoryAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: StaffDirectoryEntryDto[]) =>
      userUpdateStaffDirectoryAdmin({
        body: {
          items: rows.map((item, index) => ({
            id: item.id,
            staffTitle: item.staffTitle ?? null,
            staffLink: item.staffLink ?? null,
            staffDisplayOrder: index,
          })),
        },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: async (data) => {
      // A refetch started before the save would land the pre-save directory
      // over this one.
      await queryClient.cancelQueries({
        queryKey: queryKeys.staffDirectoryAdmin(),
      });
      queryClient.setQueryData(queryKeys.staffDirectoryAdmin(), data);
      onSuccess();
    },
    onError,
  });
}
