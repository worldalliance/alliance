import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";

/** Which copy a contract reminder sent; a reworded copy gets a new value. */
export enum ContractReminderCopy {
  Control = "control",
  AgreementV1 = "agreement_v1",
  ControlV2 = "control_v2",
  AgreementV2 = "agreement_v2",
}

/** The copies still sent; stored tracking contexts also hold the earlier ones. */
export type SentContractReminderCopy =
  | ContractReminderCopy.ControlV2
  | ContractReminderCopy.AgreementV2;

export const CONTRACT_REMINDER_COPY: Record<
  ExperimentArm,
  SentContractReminderCopy
> = {
  [ExperimentArm.Control]: ContractReminderCopy.ControlV2,
  [ExperimentArm.Variant]: ContractReminderCopy.AgreementV2,
};
