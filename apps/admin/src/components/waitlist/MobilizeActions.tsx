import { withCount } from "@alliance/common/plural";
import {
  waitlistAdminMobilizeEntriesAdmin,
  waitlistAdminUnmobilizeEntriesAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import ConfirmDialog from "../ConfirmDialog";

enum MobilizeChange {
  Mark = "mark",
  Undo = "undo",
}

const CHANGES: Record<
  MobilizeChange,
  {
    button: string;
    title: string;
    message: (selected: string) => string;
    done: (changed: string) => string;
    send: typeof waitlistAdminMobilizeEntriesAdmin;
  }
> = {
  [MobilizeChange.Mark]: {
    button: "Mark mobilized",
    title: "Mark as mobilized?",
    message: (selected) =>
      `Mark the waiting ones among ${selected} as mobilized. This sends no email and issues no invite; use it for people accepted outside the app. Entries already mobilized keep their date.`,
    done: (changed) => `Marked ${changed} mobilized`,
    send: waitlistAdminMobilizeEntriesAdmin,
  },
  [MobilizeChange.Undo]: {
    button: "Undo mobilized",
    title: "Undo mobilization?",
    message: (selected) =>
      `Return the mobilized ones among ${selected} to waiting. Any invite already sent stays usable; revoke it separately if they should not sign up.`,
    done: (changed) => `Returned ${changed} to waiting`,
    send: waitlistAdminUnmobilizeEntriesAdmin,
  },
};

const MobilizeActions: React.FC<{
  selectedIds: ReadonlySet<number>;
  onChanged: () => void;
}> = ({ selectedIds, onChanged }) => {
  const queryClient = useQueryClient();
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [confirming, setConfirming] = useState<{
    kind: MobilizeChange;
    entryIds: number[];
  } | null>(null);

  const change = useMutation({
    mutationFn: (params: { kind: MobilizeChange; entryIds: number[] }) =>
      CHANGES[params.kind]
        .send({ body: { entryIds: params.entryIds }, throwOnError: true })
        .then((r) => r.data.changed),
    onSuccess: (changed, { kind }) => {
      onChanged();
      success(CHANGES[kind].done(withCount(changed, "entry")));
    },
    onError: (err) => refusalToast(err, "Could not change mobilized status."),
    onSettled: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEntriesAdminAll(),
      });
    },
  });

  return (
    <>
      {Object.values(MobilizeChange).map((kind) => (
        <Button
          key={kind}
          color={ButtonColor.White}
          size="small"
          disabled={selectedIds.size === 0 || change.isPending}
          onClick={() => setConfirming({ kind, entryIds: [...selectedIds] })}
        >
          {CHANGES[kind].button}
        </Button>
      ))}
      <ConfirmDialog
        isOpen={confirming !== null}
        title={confirming ? CHANGES[confirming.kind].title : ""}
        message={
          confirming
            ? CHANGES[confirming.kind].message(
                withCount(confirming.entryIds.length, "selected entry"),
              )
            : ""
        }
        onConfirm={() => confirming && change.mutate(confirming)}
        onCancel={() => setConfirming(null)}
        isLoading={change.isPending}
      />
    </>
  );
};

export default MobilizeActions;
