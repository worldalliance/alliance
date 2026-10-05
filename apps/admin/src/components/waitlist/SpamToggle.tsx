import type { AdminWaitlistEntryDto } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ShieldAlert } from "lucide-react";
import React from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import {
  useChangeWaitlistEntriesAdmin,
  WaitlistEntryChange,
} from "../../lib/useWaitlistEntriesAdmin";
import { SPAM_STATUSES } from "../../lib/waitlistFilter";
import { ICON_BUTTON_CLASS } from "./controlClasses";

export const SPAM_CHANGE_FAILED = "Could not change spam status.";

const SpamToggle: React.FC<{
  entry: AdminWaitlistEntryDto;
  onChanged: () => void;
}> = ({ entry, onChanged }) => {
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const { label, spamLike } = SPAM_STATUSES[entry.spamStatus];
  const action = spamLike ? "Mark as not spam" : "Mark as spam";

  const toggle = useChangeWaitlistEntriesAdmin({
    onSuccess: () => {
      onChanged();
      success(`Marked ${entry.name} as ${spamLike ? "not spam" : "spam"}`);
    },
    onError: (err) => refusalToast(err, SPAM_CHANGE_FAILED),
    onSettled: () => {},
  });

  return (
    <button
      type="button"
      aria-label={`${action}: ${entry.name}`}
      title={`${label}. ${action}`}
      className={cn(ICON_BUTTON_CLASS, spamLike && "text-red-600")}
      disabled={toggle.isPending}
      onClick={() =>
        toggle.mutate({
          kind: spamLike
            ? WaitlistEntryChange.MarkNotSpam
            : WaitlistEntryChange.MarkSpam,
          entryIds: [entry.id],
        })
      }
    >
      <ShieldAlert size={16} />
    </button>
  );
};

export default SpamToggle;
