import {
  type StaffDirectoryEntryDto,
  userStaffDirectoryAdmin,
  userUpdateStaffDirectoryAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useStoreQueryData } from "./usePatchQueryData";

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
  const storeQueryData = useStoreQueryData();
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
      await storeQueryData(queryKeys.staffDirectoryAdmin(), data);
      onSuccess();
    },
    onError,
  });
}
