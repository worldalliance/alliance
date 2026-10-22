import type { ContractEventDto, ContractEventType } from "../client";
import { formatShortDate } from "./dateFormatters";

export type ContractEventState = Pick<
  ContractEventDto,
  "type" | "date" | "automatic" | "contractId"
> | null;

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
    text: "I understand that if I miss any assigned non-optional task for 3 weeks in a row, my agreement will be suspended automatically.",
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
    ? `Your agreement was suspended automatically on ${formattedDate}.`
    : `You suspended your agreement on ${formattedDate}.`;
}

export function getSignedMessage(date: string): string {
  const formattedDate = formatContractDate(date);
  return `You entered into this agreement on ${formattedDate}.`;
}

const IS_SIGNING: Record<ContractEventType, boolean> = {
  signed: true,
  suspended: false,
};

export function formatCurrentSigningDate(
  lastContractEvent: ContractEventDto | undefined,
): string | null {
  return lastContractEvent && IS_SIGNING[lastContractEvent.type]
    ? formatShortDate(new Date(lastContractEvent.date))
    : null;
}

/** The statement a member types to sign the agreement. */
export const WEEKLY_COMMITMENT_CONFIRMATION =
  "I commit to complete each task to the best of my ability.";

const CONFIRMATION_LENGTH_TOLERANCE = 10;

// Length-only, so a typo in the typed statement still counts.
function isConfirmationCloseEnough(typed: string): boolean {
  return (
    Math.abs(typed.trim().length - WEEKLY_COMMITMENT_CONFIRMATION.length) <=
    CONFIRMATION_LENGTH_TOLERANCE
  );
}

export function canSignAgreement(params: {
  signedName: string;
  confirmation: string;
  isSubmitting: boolean;
}): boolean {
  return (
    !params.isSubmitting &&
    params.signedName !== "" &&
    isConfirmationCloseEnough(params.confirmation)
  );
}

export function signedContractId(event: ContractEventState): number | null {
  return event && IS_SIGNING[event.type] ? event.contractId : null;
}

export function signedContractEvent(params: {
  contractId: number;
  date: string;
}): NonNullable<ContractEventState> {
  return { type: "signed", automatic: false, ...params };
}

export function suspendedContractEvent(
  date: string,
): NonNullable<ContractEventState> {
  return { type: "suspended", date, automatic: false, contractId: null };
}
