import { skipToken, useQuery } from "@tanstack/react-query";
import { contractGetById } from "../client";
import { queryKeys } from "./queryKeys";

export function useContractById(contractId: number | null) {
  return useQuery({
    queryKey: queryKeys.contractById(contractId),
    queryFn:
      contractId === null
        ? skipToken
        : () =>
            contractGetById({ path: { id: contractId } }).then(
              (res) => res.data ?? null,
            ),
  });
}
