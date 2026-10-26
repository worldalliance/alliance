export const ContractEvents = {
  Signed: "contract.signed",
  Reinstated: "contract.reinstated",
} as const;

export type ContractSignedPayload = { userId: number };

export type ContractReinstatedPayload = { notificationId: number };
