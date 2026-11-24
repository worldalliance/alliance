import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import type { UseMutationResult } from "@tanstack/react-query";
import React from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";

const SuitePartitionConvert: React.FC<{
  convert: UseMutationResult<unknown, Error, void>;
  onConverted: () => void;
  canPartition: boolean;
}> = ({ convert, onConverted, canPartition }) => {
  const { confirm } = useToast();
  const partitionSuite = async (anchorEl: HTMLElement) => {
    if (convert.isPending) return;
    const confirmed = await confirm({
      title: "Partition this suite?",
      message: "This can't be undone. A partitioned suite can't launch yet.",
      confirmLabel: "Partition suite",
      anchorEl,
    });
    if (confirmed) convert.mutate(undefined, { onSuccess: onConverted });
  };

  return (
    <>
      <p className="text-sm text-zinc-600">
        A partition sorts this suite&apos;s members into parts. Each member
        lands in the first part whose condition they match, and the part sets
        which of the suite&apos;s actions they get and whether each is required
        or optional. It replaces each action&apos;s own participants and
        prerequisites, and can&apos;t be undone.
      </p>
      {!canPartition && (
        <p className="text-sm text-zinc-600">
          Partitioning is off until a partition can be undone.
        </p>
      )}
      <Button
        color={ButtonColor.White}
        disabled={!canPartition}
        aria-disabled={convert.isPending}
        className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
        onClick={(event) => void partitionSuite(event.currentTarget)}
      >
        {convert.isPending ? "Partitioning…" : "Partition this suite"}
      </Button>
      {convert.isError && (
        <p role="alert" className="text-sm text-red-700">
          {adminRefusalMessage(convert.error, "Couldn't partition this suite.")}
        </p>
      )}
    </>
  );
};

export default SuitePartitionConvert;
