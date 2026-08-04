import type { ContractEventDto } from "../client";

export type ContractEventState = Pick<
  ContractEventDto,
  "type" | "date" | "automatic" | "contractId"
> | null;

export function getLastContractEvent(
  contractEvents: ContractEventDto[] | undefined,
): ContractEventState {
  if (!contractEvents?.length) {
    return null;
  }
  return contractEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];
}

export const PLACEHOLDER_CONTRACT_MARKDOWN = `
1. I commit to complete up to 15 minutes of Alliance tasks per week.

2. I commit to complete every task I am assigned by its deadline, unless:

   a. I have spent more than 15 minutes completing Alliance tasks in the past week.

   b. I cannot complete the task due to a serious external circumstance, such as a medical issue or family emergency. In this case, I will inform the strategic office as soon as I can.

   c. I believe the task is immoral. In this case, I will inform the strategic office of my reasoning by the deadline for the task.

3. I understand that if I miss all assigned non-optional actions for 3 weeks in a row, my contract will be suspended automatically.
`.trim();

export const CONTRACT_NOTES = [
  "You can terminate your membership at any time.",
  "If you miss all assigned non-optional actions for 3 weeks in a row, your contract will be suspended automatically. You can re-sign the contract to re-join the Alliance.",
] as const;

export function formatContractDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function getSuspensionMessage(date: string, automatic: boolean): string {
  const formattedDate = formatContractDate(date);
  return automatic
    ? `Your contract was suspended automatically on ${formattedDate}.`
    : `You suspended your contract on ${formattedDate}.`;
}

export function getSignedMessage(date: string): string {
  const formattedDate = formatContractDate(date);
  return `You signed this contract on ${formattedDate}.`;
}
