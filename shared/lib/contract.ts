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

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export type ContractTerm = {
  text: string;
  subItems?: readonly string[];
};

/** The numbered terms members sign, with lettered exceptions where they apply. */
export const CONTRACT_TERMS: readonly ContractTerm[] = [
  {
    text: "I commit to complete up to 15 minutes of Alliance tasks per week.",
  },
  {
    text: "I commit to complete every task I am assigned by its deadline, unless:",
    subItems: [
      "I have spent more than 15 minutes completing Alliance tasks in the past week.",
      "I cannot complete the task due to a serious external circumstance, such as a medical issue or family emergency. In this case, I will inform the strategic office as soon as I can.",
      "I believe the task is immoral. In this case, I will inform the strategic office of my reasoning by the deadline for the task.",
    ],
  },
  {
    text: "I understand that if I miss all assigned non-optional actions for 3 weeks in a row, my contract will be suspended automatically.",
  },
];

export const PLACEHOLDER_CONTRACT_MARKDOWN = CONTRACT_TERMS.map((term, i) => {
  const head = `${i + 1}. ${term.text}`;
  if (!term.subItems) return head;
  const subs = term.subItems
    .map((item, j) => `   ${LETTERS[j]}. ${item}`)
    .join("\n\n");
  return `${head}\n\n${subs}`;
}).join("\n\n");

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
