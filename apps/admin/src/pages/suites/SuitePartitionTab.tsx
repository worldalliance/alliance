import { Features } from "@alliance/common/features";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { isFeatureEnabled } from "@alliance/sharedweb/lib/config";
import SuitePartitionSection from "../../components/suite-partition/SuitePartitionSection";
import { EmptyState } from "../../ui/EmptyState";

/** The suite's parts, or the way to partition it. */
export function SuitePartitionTab({
  suite,
  launched,
}: {
  suite: ActionSuiteDto;
  launched: boolean;
}) {
  if (launched && !suite.isPartitioned) {
    return (
      <EmptyState
        title="This suite has no parts"
        description="It is scheduled to launch, so it can't be partitioned now."
      />
    );
  }
  return (
    <SuitePartitionSection
      suiteId={suite.id}
      isPartitioned={suite.isPartitioned}
      scheduled={launched}
      canPartition={isFeatureEnabled(Features.SuitePartitioning)}
    />
  );
}
