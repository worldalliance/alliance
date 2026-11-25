import { Features } from "@alliance/common/features";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { isFeatureEnabled } from "@alliance/sharedweb/lib/config";
import { useState } from "react";
import { useSuitePartition } from "../../lib/useSuitePartition";
import { EmptyState } from "../../ui/EmptyState";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, FormSkeleton } from "../../ui/templates/States";
import { PartitionConvertPanel } from "./partition/PartitionConvertPanel";
import { PartitionEditor } from "./partition/PartitionEditor";

/**
 * The suite's parts once it has them; before that, the way to partition it
 * while it has no members taking action event.
 */
export function SuitePartitionTab({
  suite,
  launched,
}: {
  suite: ActionSuiteDto;
  launched: boolean;
}) {
  const { partition, convert, save, preview } = useSuitePartition(
    suite.id,
    suite.isPartitioned,
  );
  const [converted, setConverted] = useState(false);

  if (!suite.isPartitioned) {
    return launched ? (
      <Panel title="Partition">
        <EmptyState
          title="This suite has no parts"
          description="It is scheduled to launch, so it can't be partitioned now."
        />
      </Panel>
    ) : (
      <PartitionConvertPanel
        convert={convert}
        canPartition={isFeatureEnabled(Features.SuitePartitioning)}
        onConverted={() => setConverted(true)}
      />
    );
  }
  return (
    <ContentState
      things="the partition"
      query={partition}
      skeleton={<FormSkeleton fields={3} />}
    >
      {partition.data && (
        <PartitionEditor
          partition={partition.data}
          scheduled={launched}
          focusOnMount={converted}
          onSave={save.mutateAsync}
          onPreview={preview.mutateAsync}
        />
      )}
    </ContentState>
  );
}
