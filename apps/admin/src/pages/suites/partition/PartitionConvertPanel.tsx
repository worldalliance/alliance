import type { UseMutationResult } from "@tanstack/react-query";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../../ui/Button";
import InlineError from "../../../ui/InlineError";
import { Panel } from "../../../ui/templates/Overview";

export function PartitionConvertPanel({
  convert,
  canPartition,
  onConverted,
}: {
  convert: UseMutationResult<unknown, Error, void>;
  canPartition: boolean;
  onConverted: () => void;
}) {
  const confirm = useConfirmOnPage();
  const partition = async () => {
    if (convert.isPending) return;
    const confirmed = await confirm({
      title: "Partition this suite?",
      message:
        "This can't be undone. A partitioned suite can't launch yet.\nThe suite starts with one part, Everyone else, given no tasks.",
      confirmLabel: "Partition suite",
    });
    if (confirmed) convert.mutate(undefined, { onSuccess: onConverted });
  };

  return (
    <Panel title="Partition">
      <div className="flex max-w-prose flex-col gap-3">
        <p>
          A partition sorts this suite&apos;s members into ordered parts. Each
          member lands in the first part whose condition they match, and the
          part decides which of the suite&apos;s tasks they&apos;re given, each
          as required or optional.
        </p>
        <p className="text-fg-muted">
          It replaces each task&apos;s own participants and prerequisites, so
          clear those first. It can&apos;t be undone, and a partitioned suite
          can&apos;t launch yet.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={ButtonVariant.Default}
            disabled={!canPartition}
            busy={convert.isPending}
            onClick={() => void partition()}
          >
            Partition this suite…
          </Button>
          {!canPartition && (
            <p className="text-fg-muted">
              Partitioning is off in production until partitioned suites can
              launch.
            </p>
          )}
        </div>
        <InlineError
          message={
            convert.isError
              ? adminRefusalMessage(
                  convert.error,
                  "Couldn't partition this suite.",
                )
              : null
          }
        />
      </div>
    </Panel>
  );
}
