import { ContractStatus } from "@alliance/shared/lib/contract";

export const CONTRACT_STATUS_TEXT_CLASS: Record<ContractStatus, string> = {
  [ContractStatus.Signed]: "text-green",
  [ContractStatus.Suspended]: "text-red-700",
  [ContractStatus.NotSigned]: "text-zinc-500",
};
