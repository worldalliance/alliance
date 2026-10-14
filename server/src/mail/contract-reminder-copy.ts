import { ExperimentArm } from "src/notifs/entities/experiment-assignment.entity";

/** Which copy a contract reminder sent; a reworded copy gets a new value. */
export enum ContractReminderCopy {
  Control = "control",
  AgreementV1 = "agreement_v1",
}

export const CONTRACT_REMINDER_COPY: Record<
  ExperimentArm,
  ContractReminderCopy
> = {
  [ExperimentArm.Control]: ContractReminderCopy.Control,
  [ExperimentArm.Variant]: ContractReminderCopy.AgreementV1,
};
