import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { withCount } from "@alliance/common/plural";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useKoraProjectAdmin,
  useNotifyKoraWaitlist,
} from "../lib/useKoraParticipantsAdmin";
import ConfirmDialog from "./ConfirmDialog";

export function KoraNotifyWaitlist() {
  const project = useKoraProjectAdmin();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const notify = useNotifyKoraWaitlist({
    onSuccess: (queued) => {
      toast.success(`Sending to ${withCount(queued, "participant")}`);
      setConfirming(false);
    },
    onError: (err) => {
      toast.error(
        adminRefusalMessage(err, "Couldn't start sending. Try again."),
      );
      setConfirming(false);
      console.error(err);
    },
  });

  if (!project.data) return null;
  const { status, toNotify } = project.data;
  const active = status === KoraProjectStatus.Active;
  const participants = withCount(toNotify, "participant");

  return (
    <section aria-labelledby="kora-notify" className="space-y-2 text-sm">
      <h2 id="kora-notify" className="font-semibold">
        Notify the waitlist
      </h2>
      <p className="text-zinc-600">
        {toNotify === 0
          ? "Everyone on the waitlist has been told the reviews are open."
          : `${participants} haven't been told the reviews are open.`}
      </p>
      {!active && toNotify > 0 && (
        <p id="kora-notify-blocked" className="text-zinc-600">
          {KORA_NOTIFY_NEEDS_ACTIVE}
        </p>
      )}
      <Button
        color={ButtonColor.Black}
        size="small"
        disabled={!active || toNotify === 0 || notify.isPending}
        aria-describedby={!active ? "kora-notify-blocked" : undefined}
        onClick={() => setConfirming(true)}
      >
        Notify {participants}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={`Notify ${participants}?`}
        message="Each gets one email or text saying the reviews are open, with a link to start reviewing. Messages can't be recalled once sent."
        confirmLabel="Send"
        isLoading={notify.isPending}
        onConfirm={() => notify.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
