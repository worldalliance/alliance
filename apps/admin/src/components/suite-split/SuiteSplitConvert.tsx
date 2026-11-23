import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import type { UseMutationResult } from "@tanstack/react-query";
import React from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";

const SuiteSplitConvert: React.FC<{
  convert: UseMutationResult<unknown, Error, void>;
  onConverted: () => void;
}> = ({ convert, onConverted }) => {
  const { confirm } = useToast();
  const startUsingGroups = async (anchorEl: HTMLElement) => {
    if (convert.isPending) return;
    const confirmed = await confirm({
      title: "Use groups?",
      message:
        "This suite can't stop using groups. Suites that use groups can't launch yet.",
      confirmLabel: "Use groups",
      anchorEl,
    });
    if (confirmed) convert.mutate(undefined, { onSuccess: onConverted });
  };

  return (
    <>
      <p className="text-sm text-zinc-600">
        Groups decide which members get which of this suite&apos;s actions, and
        whether each is required or optional, in place of each action&apos;s own
        participants. A suite can&apos;t stop using groups.
      </p>
      <Button
        color={ButtonColor.White}
        aria-disabled={convert.isPending}
        className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
        onClick={(event) => void startUsingGroups(event.currentTarget)}
      >
        {convert.isPending ? "Starting…" : "Use groups"}
      </Button>
      {convert.isError && (
        <p role="alert" className="text-sm text-red-700">
          {adminRefusalMessage(convert.error, "Couldn't start using groups.")}
        </p>
      )}
    </>
  );
};

export default SuiteSplitConvert;
