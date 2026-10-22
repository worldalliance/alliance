import {
  type ContractAdminDto,
  contractCreateAdmin,
  contractFindOneAdmin,
  contractUpdateAdmin,
  type CreateContractDto,
  type UpdateContractDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useInvalidateContractsAdmin } from "./useContractsAdmin";
import { useStoreQueryData } from "./usePatchQueryData";

/** One admin contract and its writes. A `null` id fetches nothing, for the
 * create page; `update` throws then. */
export function useContractAdmin(id: number | null) {
  const storeQueryData = useStoreQueryData();
  const invalidateList = useInvalidateContractsAdmin();

  const query = useQuery({
    queryKey: queryKeys.contractAdmin(id),
    queryFn:
      id === null
        ? skipToken
        : () =>
            contractFindOneAdmin({ path: { id }, throwOnError: true }).then(
              (r) => r.data,
            ),
  });

  const store = async (saved: ContractAdminDto) => {
    await storeQueryData(queryKeys.contractAdmin(saved.id), saved);
    await invalidateList();
  };

  const create = useMutation({
    mutationFn: (body: CreateContractDto) =>
      contractCreateAdmin({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: store,
  });

  const update = useMutation({
    mutationFn: (body: UpdateContractDto) => {
      if (id === null) throw new Error("No contract to update");
      return contractUpdateAdmin({
        path: { id },
        body,
        throwOnError: true,
      }).then((r) => r.data);
    },
    onSuccess: store,
  });

  return { query, create, update };
}
