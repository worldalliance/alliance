import { ContractStatus } from "@alliance/shared/lib/contract";
import { StatusTone } from "./statusTone";

export const CONTRACT_STATUS_TEXT_CLASS: Record<ContractStatus, string> = {
  [ContractStatus.Signed]: "text-green",
  [ContractStatus.Suspended]: "text-red-700",
  [ContractStatus.NotSigned]: "text-zinc-500",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, StatusTone> = {
  [ContractStatus.Signed]: StatusTone.Positive,
  [ContractStatus.Suspended]: StatusTone.Negative,
  [ContractStatus.NotSigned]: StatusTone.Neutral,
};
