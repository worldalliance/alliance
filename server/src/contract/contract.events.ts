export const ContractEvents = {
  Signed: "contract.signed",
} as const;

export type ContractSignedPayload = { userId: number };
