import React, { useRef } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useSuitePartition } from "../../lib/useSuitePartition";
import SuitePartitionConvert from "./SuitePartitionConvert";
import SuitePartitionEditor from "./SuitePartitionEditor";

/**
 * A suite's partition: the editor once the suite has one, otherwise the way to
 * partition it while it isn't scheduled. The heading stays mounted, so focus
 * moves to it when the control holding focus goes away.
 */
const SuitePartitionSection: React.FC<{
  suiteId: number;
  isPartitioned: boolean;
  scheduled: boolean;
}> = ({ suiteId, isPartitioned, scheduled }) => {
  const { partition, convert, save, preview } = useSuitePartition(
    suiteId,
    isPartitioned,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = () => heading.current?.focus();
  if (!isPartitioned && scheduled) return null;
  const body = !isPartitioned ? (
    <SuitePartitionConvert convert={convert} onConverted={focusHeading} />
  ) : partition.data !== undefined ? (
    <SuitePartitionEditor
      partition={partition.data}
      onSave={save.mutateAsync}
      onPreview={(parts) => preview.mutateAsync(parts)}
      onLoadLatest={focusHeading}
    />
  ) : partition.isError ? (
    <p role="alert" className="text-sm text-red-700">
      {adminRefusalMessage(partition.error, "Couldn't load the partition.")}
    </p>
  ) : (
    <p className="text-sm text-zinc-600">Loading the partition…</p>
  );
  return (
    <section aria-labelledby="partition-heading" className="space-y-2">
      <h2
        id="partition-heading"
        ref={heading}
        tabIndex={-1}
        className="font-semibold"
      >
        Partition
      </h2>
      {body}
    </section>
  );
};

export default SuitePartitionSection;
