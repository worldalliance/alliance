import { R, type Result } from "@alliance/common/result";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  contractSignContract,
  contractSuspendContract,
  type ContractEventDateDto,
} from "../client";
import { meCache } from "./useMe";
import { useInvalidateVisibilityContext } from "./useVisibilityContext";

/**
 * Signs or suspends the member's contract and reloads what the change moves.
 * A failure carries what the client threw and leaves the caches alone.
 */
export function useContractSignature() {
  const queryClient = useQueryClient();
  const invalidateVisibilityContext = useInvalidateVisibilityContext();
  return useMemo(() => {
    const me = meCache(queryClient);
    const written = async (
      write: Promise<{ data: ContractEventDateDto }>,
    ): Promise<Result<ContractEventDateDto, unknown>> =>
      R.map(await R.fromPromise(write, (error) => error), ({ data }) => data);
    return {
      sign: async (params: { contractId: number; signedName: string }) => {
        const signed = await written(
          contractSignContract({
            path: { id: params.contractId },
            body: { signedName: params.signedName },
            throwOnError: true,
          }),
        );
        if (signed.ok) {
          invalidateVisibilityContext();
          await me.refresh();
        }
        return signed;
      },
      suspend: async () => {
        const suspended = await written(
          contractSuspendContract({ throwOnError: true }),
        );
        if (suspended.ok) await me.refresh();
        return suspended;
      },
    };
  }, [queryClient, invalidateVisibilityContext]);
}
