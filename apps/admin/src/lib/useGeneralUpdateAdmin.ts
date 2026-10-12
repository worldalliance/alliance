import {
  actionsCreateGeneralUpdateAdmin,
  actionsFindOneGeneralUpdateAdmin,
  actionsUpdateGeneralUpdateAdmin,
  type CreateGeneralUpdateDto,
  type GeneralUpdateAdminDto,
  type UpdateGeneralUpdateDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  useDisplayOnlySchemaSave,
  type DisplayOnlySchemaSaveBody,
} from "./useDisplayOnlySchemaSave";
import { useInvalidateGeneralUpdatesAdmin } from "./useGeneralUpdatesAdmin";
import { useStoreQueryData } from "./usePatchQueryData";

/** One admin general update and its writes. A `null` id fetches nothing, for
 * the create page; `update` and `saveSchema` throw then. */
export function useGeneralUpdateAdmin(id: number | null) {
  const storeQueryData = useStoreQueryData();
  const invalidateList = useInvalidateGeneralUpdatesAdmin();

  const query = useQuery({
    queryKey: queryKeys.generalUpdateAdmin(id),
    queryFn:
      id === null
        ? skipToken
        : () =>
            actionsFindOneGeneralUpdateAdmin({
              path: { id },
              throwOnError: true,
            }).then((r) => r.data),
  });

  const store = useCallback(
    async (saved: GeneralUpdateAdminDto) => {
      await storeQueryData(queryKeys.generalUpdateAdmin(saved.id), saved);
      await invalidateList();
    },
    [storeQueryData, invalidateList],
  );

  const create = useMutation({
    mutationFn: (body: CreateGeneralUpdateDto) =>
      actionsCreateGeneralUpdateAdmin({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: store,
  });

  const update = useMutation({
    mutationFn: (body: UpdateGeneralUpdateDto) => {
      if (id === null) throw new Error("No general update to update");
      return actionsUpdateGeneralUpdateAdmin({
        path: { id },
        body,
        throwOnError: true,
      }).then((r) => r.data);
    },
    onSuccess: store,
  });

  const saveSchema = useDisplayOnlySchemaSave({
    ownerLabel: "General updates",
    save: useCallback(
      (body: DisplayOnlySchemaSaveBody) => {
        if (id === null) throw new Error("Missing general update id");
        return actionsUpdateGeneralUpdateAdmin({ path: { id }, body });
      },
      [id],
    ),
    refetch: useCallback(() => {
      if (id === null) throw new Error("Missing general update id");
      return actionsFindOneGeneralUpdateAdmin({ path: { id } });
    }, [id]),
    onSaved: useCallback(
      (saved: GeneralUpdateAdminDto) => void store(saved),
      [store],
    ),
  });

  return { query, create, update, saveSchema };
}
