import { BadgeTone } from "../../ui/Badge";

export const contractName = (contract: { id: number; name?: string | null }) =>
  contract.name?.trim() || `Contract #${contract.id}`;

export enum ContractStatus {
  Active = "active",
  Scheduled = "scheduled",
  Inactive = "inactive",
}

/** The order the list groups them in. */
export const CONTRACT_STATUSES = [
  ContractStatus.Active,
  ContractStatus.Scheduled,
  ContractStatus.Inactive,
] as const;

export const STATUS_LABEL: Record<ContractStatus, string> = {
  [ContractStatus.Active]: "Active",
  [ContractStatus.Scheduled]: "Scheduled",
  [ContractStatus.Inactive]: "Inactive",
};

export const STATUS_TONE: Record<ContractStatus, BadgeTone> = {
  [ContractStatus.Active]: BadgeTone.Success,
  [ContractStatus.Scheduled]: BadgeTone.Info,
  [ContractStatus.Inactive]: BadgeTone.Neutral,
};

type Scheduled = {
  id: number;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * Active is the one contract the server hands members to sign, whose id the
 * caller has from the current-contract endpoint. Inactive covers one with no
 * start date, one that ended, and one a later start replaced.
 */
export function statusOf(
  contract: Scheduled,
  { activeId, now }: { activeId: number | null; now: Date },
): ContractStatus {
  if (contract.id === activeId) return ContractStatus.Active;
  if (contract.startDate && new Date(contract.startDate) > now)
    return ContractStatus.Scheduled;
  return ContractStatus.Inactive;
}

const startOf = (contract: Scheduled) =>
  contract.startDate ? new Date(contract.startDate).getTime() : 0;

/** Scheduled ones soonest first; the rest keep the order they came in. */
export function groupByStatus<T extends Scheduled>(
  contracts: readonly T[],
  at: { activeId: number | null; now: Date },
): { status: ContractStatus; contracts: T[] }[] {
  return CONTRACT_STATUSES.map((status) => {
    const group = contracts.filter(
      (contract) => statusOf(contract, at) === status,
    );
    return {
      status,
      contracts:
        status === ContractStatus.Scheduled
          ? group.sort((a, b) => startOf(a) - startOf(b))
          : group,
    };
  }).filter((group) => group.contracts.length > 0);
}

/**
 * The server's own choice of the contract members sign, worked out from the
 * list: the latest start that has passed, among those whose end hasn't.
 */
export function inForceOf<T extends Scheduled>(
  contracts: readonly T[],
  now: Date,
): T | null {
  const inForce = contracts.filter(
    ({ startDate, endDate }) =>
      startDate &&
      new Date(startDate) <= now &&
      (!endDate || new Date(endDate) > now),
  );
  return inForce.sort((a, b) => startOf(b) - startOf(a)).at(0) ?? null;
}
