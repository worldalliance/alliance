import type { ContractDto } from "@alliance/shared/client";
import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { useCurrentContract } from "@alliance/shared/lib/useCurrentContract";

const placeholderContract: ContractDto = {
  id: 1,
  markdown: PLACEHOLDER_CONTRACT_MARKDOWN,
  description: [],
};

export function useContract() {
  const { data } = useCurrentContract();

  return { latestContract: data === undefined ? placeholderContract : data };
}
