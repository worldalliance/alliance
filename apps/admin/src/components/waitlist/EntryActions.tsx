import { withCount } from "@alliance/common/plural";
import {
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
} from "@alliance/common/waitlistEmail";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import {
  WaitlistEntryChange as EntryChange,
  useChangeWaitlistEntriesAdmin,
} from "../../lib/useWaitlistEntriesAdmin";
import ConfirmDialog from "../ConfirmDialog";

const MOBILIZED_FAILED = "Could not change mobilized status.";

const CHANGES: Record<
  EntryChange,
  {
    button: string;
    title: string;
    message: (selected: string) => string;
    changedNoun: string;
    done: (changed: string) => string;
    failed: string;
  }
> = {
  [EntryChange.Mark]: {
    button: "Mark mobilized",
    title: "Mark as mobilized?",
    message: (selected) =>
      `Mark the waiting ones among ${selected} as mobilized. This sends no email and issues no invite; use it for people accepted outside the app. Entries already mobilized keep their date.`,
    changedNoun: "entry",
    done: (changed) => `Marked ${changed} mobilized`,
    failed: MOBILIZED_FAILED,
  },
  [EntryChange.Undo]: {
    button: "Undo mobilized",
    title: "Undo mobilization?",
    message: (selected) =>
      `Return the mobilized ones among ${selected} to waiting. Any invite already sent stays usable; revoke it separately if they should not sign up.`,
    changedNoun: "entry",
    done: (changed) => `Returned ${changed} to waiting`,
    failed: MOBILIZED_FAILED,
  },
  [EntryChange.RevokeInvites]: {
    button: "Revoke invites",
    title: "Revoke unused invites?",
    message: (selected) =>
      `Revoke the unused signup invites of ${selected}, so their signup links stop working. Mobilized status stays as it is, and the next email with ${waitlistEmailToken(WaitlistEmailPlaceholder.SignupLink)} sends a new invite. An invite in an email being sent right now is kept.`,
    changedNoun: "invite",
    done: (changed) => `Revoked ${changed}`,
    failed: "Could not revoke the invites.",
  },
};

const EntryActions: React.FC<{
  selectedIds: ReadonlySet<number>;
  onChanged: () => void;
}> = ({ selectedIds, onChanged }) => {
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [confirming, setConfirming] = useState<{
    kind: EntryChange;
    entryIds: number[];
  } | null>(null);

  const change = useChangeWaitlistEntriesAdmin({
    onSuccess: (changed, kind) => {
      onChanged();
      success(
        CHANGES[kind].done(withCount(changed, CHANGES[kind].changedNoun)),
      );
    },
    onError: (err, kind) => refusalToast(err, CHANGES[kind].failed),
    onSettled: () => setConfirming(null),
  });

  return (
    <>
      {Object.values(EntryChange).map((kind) => (
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

export default EntryActions;
