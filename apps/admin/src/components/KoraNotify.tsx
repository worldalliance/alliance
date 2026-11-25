import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { withCount } from "@alliance/common/plural";
import type { KoraAdminProjectDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  KoraNoticeKind,
  useKoraProjectAdmin,
  useSendKoraNotice,
} from "../lib/useKoraParticipantsAdmin";
import ConfirmDialog from "./ConfirmDialog";

const NOTICE: Record<
  KoraNoticeKind,
  {
    heading: string;
    waiting: (project: KoraAdminProjectDto) => number;
    noun: string;
    pending: (people: string) => string;
    none: string;
    confirm: string;
  }
> = {
  [KoraNoticeKind.Launch]: {
    heading: "Notify the waitlist",
    waiting: (p) => p.toNotify,
    noun: "participant",
    pending: (people) => `${people} haven't been told the reviews are open.`,
    none: "Everyone on the waitlist has been told the reviews are open.",
    confirm:
      "Each gets one email or text saying the reviews are open, with a link to start reviewing. Messages can't be recalled once sent.",
  },
  [KoraNoticeKind.More]: {
    heading: "Tell earlier reviewers there's more",
    waiting: (p) => p.moreToNotify,
    noun: "reviewer",
    pending: (people) =>
      `${people} finished an assignment and haven't been told about the newest transcripts.`,
    none: "Every reviewer who finished has been told about the newest transcripts.",
    confirm:
      "Participants get one email or text, and members a push notification, saying more reviews are ready. Messages can't be recalled once sent.",
  },
};

export function KoraNotify({ notice }: { notice: KoraNoticeKind }) {
  const project = useKoraProjectAdmin();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const copy = NOTICE[notice];
  const send = useSendKoraNotice({
    notice,
    onSuccess: (queued) => {
      toast.success(`Sending to ${withCount(queued, copy.noun)}`);
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
  const waiting = copy.waiting(project.data);
  const active = project.data.status === KoraProjectStatus.Active;
  const people = withCount(waiting, copy.noun);
  const blockedId = `kora-notify-${notice}-blocked`;

  return (
    <section
      aria-labelledby={`kora-notify-${notice}`}
      className="space-y-2 text-sm"
    >
      <h2 id={`kora-notify-${notice}`} className="font-semibold">
        {copy.heading}
      </h2>
      <p className="text-zinc-600">
        {waiting === 0 ? copy.none : copy.pending(people)}
      </p>
      {!active && waiting > 0 && (
        <p id={blockedId} className="text-zinc-600">
          {KORA_NOTIFY_NEEDS_ACTIVE}
        </p>
      )}
      <Button
        color={ButtonColor.Black}
        size="small"
        disabled={!active || waiting === 0 || send.isPending}
        aria-describedby={!active ? blockedId : undefined}
        onClick={() => setConfirming(true)}
      >
        Notify {people}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={`Notify ${people}?`}
        message={copy.confirm}
        confirmLabel="Send"
        isLoading={send.isPending}
        onConfirm={() => send.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
