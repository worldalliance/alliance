import { formatCount } from "../../lib/formatNumber";
import { Select } from "../../ui/Select";
import {
  COMPLETION_FILTER_LABELS,
  CompletionFilter,
  CONTRACT_FILTER_LABELS,
  ContractFilter,
} from "./progressRules";

const withCount = (label: string, count: number | undefined) =>
  count === undefined ? label : `${label} (${formatCount(count)})`;

/**
 * The contract and caught-up filters over members with task progress, each
 * choice with the members it would show. Pass the lists `filterByProgress`
 * returns.
 */
export function ProgressFilters({
  contract,
  onContractChange,
  completion,
  onCompletionChange,
  contractCounts,
  completionCounts,
}: {
  contract: ContractFilter;
  onContractChange: (contract: ContractFilter) => void;
  completion: CompletionFilter;
  onCompletionChange: (completion: CompletionFilter) => void;
  contractCounts: Record<ContractFilter, number> | undefined;
  /** Undefined while the task records are unknown, which disables the filter. */
  completionCounts: Record<CompletionFilter, number> | undefined;
}) {
  return (
    <>
      <Select
        aria-label="Contract"
        className="h-control-sm w-auto"
        value={contract}
        onChange={(event) => {
          const picked = Object.values(ContractFilter).find(
            (value) => value === event.target.value,
          );
          if (picked) onContractChange(picked);
        }}
      >
        {Object.values(ContractFilter).map((value) => (
          <option key={value} value={value}>
            {withCount(CONTRACT_FILTER_LABELS[value], contractCounts?.[value])}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Caught up"
        className="h-control-sm w-auto"
        value={completion}
        disabled={completionCounts === undefined}
        onChange={(event) => {
          const picked = Object.values(CompletionFilter).find(
            (value) => value === event.target.value,
          );
          if (picked) onCompletionChange(picked);
        }}
      >
        {Object.values(CompletionFilter).map((value) => (
          <option key={value} value={value}>
            {withCount(
              COMPLETION_FILTER_LABELS[value],
              completionCounts?.[value],
            )}
          </option>
        ))}
      </Select>
    </>
  );
}
