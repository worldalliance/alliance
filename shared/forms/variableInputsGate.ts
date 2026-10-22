import {
  VariableAggregatesStatus,
  type VariableAggregates,
} from "./useVariableAggregates";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";

export type VariableInputsGate =
  | { status: SourceHistoriesStatus.Loading }
  | { status: SourceHistoriesStatus.Failed; retry: () => void }
  | { status: SourceHistoriesStatus.SourceDeleted }
  | { status: SourceHistoriesStatus.Ready };

const AGGREGATES_GATE: Record<VariableAggregatesStatus, SourceHistoriesStatus> =
  {
    [VariableAggregatesStatus.Loading]: SourceHistoriesStatus.Loading,
    [VariableAggregatesStatus.Failed]: SourceHistoriesStatus.Failed,
    [VariableAggregatesStatus.SourceUnavailable]:
      SourceHistoriesStatus.SourceDeleted,
    [VariableAggregatesStatus.Ready]: SourceHistoriesStatus.Ready,
  };

/**
 * Loading outranks a failure, and a failure a retry may clear outranks a
 * deletion none can.
 */
const GATE_RANK: Record<SourceHistoriesStatus, number> = {
  [SourceHistoriesStatus.Loading]: 3,
  [SourceHistoriesStatus.Failed]: 2,
  [SourceHistoriesStatus.SourceDeleted]: 1,
  [SourceHistoriesStatus.Ready]: 0,
};

/**
 * Whether a form can show yet, from everything its variables load. Retry
 * refetches whatever failed.
 */
export function variableInputsGate(
  histories: SourceHistories,
  aggregates: VariableAggregates,
): VariableInputsGate {
  const aggregatesStatus = AGGREGATES_GATE[aggregates.status];
  const status =
    GATE_RANK[histories.status] >= GATE_RANK[aggregatesStatus]
      ? histories.status
      : aggregatesStatus;
  switch (status) {
    case SourceHistoriesStatus.Loading:
    case SourceHistoriesStatus.SourceDeleted:
    case SourceHistoriesStatus.Ready:
      return { status };
    case SourceHistoriesStatus.Failed:
      return {
        status,
        retry: () => {
          if (histories.status === SourceHistoriesStatus.Failed) {
            histories.retry();
          }
          if (aggregates.status === VariableAggregatesStatus.Failed) {
            aggregates.retry();
          }
        },
      };
    default:
      throw new Error(
        `unknown variable inputs status: ${status satisfies never}`,
      );
  }
}
