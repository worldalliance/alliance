import type { ActionSuiteDto } from "@alliance/shared/client";

export const ACTION_TEXT_FIELD_LABELS = {
  name: "Name",
  shortDescription: "Short description",
  body: "Task page description",
} as const;

/** Whether the action's suite decides its participants and optional work by parts. */
export const inPartitionedSuite = (
  suites: readonly Pick<ActionSuiteDto, "id" | "isPartitioned">[],
  suiteId: number | null | undefined,
) => suites.some((suite) => suite.id === suiteId && suite.isPartitioned);

/** Whether the suites are still loading, or failed to, for an action in one. */
export const suiteKindUnknown = (
  params: { loading: boolean; failed: boolean },
  suiteId: number | null | undefined,
) => suiteId != null && (params.loading || params.failed);

/** Whether the action's suite sets its optional flag, or may while the suites are unknown. */
export const partsMaySetOptional = (
  params: {
    suites: readonly Pick<ActionSuiteDto, "id" | "isPartitioned">[];
    loading: boolean;
    failed: boolean;
  },
  suiteId: number | null | undefined,
) =>
  suiteKindUnknown(params, suiteId) ||
  inPartitionedSuite(params.suites, suiteId);
