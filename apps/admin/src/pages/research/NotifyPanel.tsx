import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KoraProjectStatus,
} from "@alliance/common/kora";
import type { KoraAdminProjectDto } from "@alliance/shared/client";
import { useId, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { notifyRealPeopleText } from "../../lib/notifyRealMembers";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  KoraNoticeKind,
  useKoraProjectAdmin,
  useSendKoraNotice,
} from "../../lib/useKoraParticipantsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Skeleton } from "../../ui/Skeleton";
import { Panel, PanelNote } from "../../ui/templates/Overview";
import { ContentState } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";

const NOTICE: Record<
  KoraNoticeKind,
  {
    heading: string;
    waiting: (project: KoraAdminProjectDto) => number;
    noun: string;
    pending: (people: string, has: string) => string;
    none: string;
    confirm: string;
  }
> = {
  [KoraNoticeKind.Launch]: {
    heading: "Notify the waitlist",
    waiting: (p) => p.toNotify,
    noun: "participant",
    pending: (people, has) =>
      `${people} ${has}n't been told the reviews are open.`,
    none: "Everyone on the waitlist has been told the reviews are open.",
    confirm:
      "Each gets one email or text saying the reviews are open, with a link to start reviewing. Sending starts at once and runs in the background. Messages can't be recalled once sent.",
  },
  [KoraNoticeKind.More]: {
    heading: "Tell earlier reviewers there's more",
    waiting: (p) => p.moreToNotify,
    noun: "reviewer",
    pending: (people, has) =>
      `${people} finished an assignment, ${has} none unfinished and ${has}n't been told about the newest transcripts.`,
    none: "Every reviewer who finished and has none unfinished has been told about the newest transcripts.",
    confirm:
      "Participants get one email or text, and members a push notification, saying more reviews are ready. Sending starts at once and runs in the background. Messages can't be recalled once sent.",
  },
};

export function NotifyPanel({ notice }: { notice: KoraNoticeKind }) {
  const project = useKoraProjectAdmin();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const blockedId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const copy = NOTICE[notice];
  const send = useSendKoraNotice({
    notice,
    onSuccess: (queued) => success(`Sending to ${countOf(queued, copy.noun)}`),
    onError: (error) =>
      setProblem(adminRefusalMessage(error, "Couldn't start sending.")),
  });

  const body = (data: KoraAdminProjectDto) => {
    const waiting = copy.waiting(data);
    const active = data.status === KoraProjectStatus.Active;
    const people = countOf(waiting, copy.noun);
    const blocked = !active && waiting > 0;
    const ask = async () => {
      const confirmed = await confirm({
        title: `Notify ${people}?`,
        message: copy.confirm,
        confirmLabel: "Send",
        requiredText: notifyRealPeopleText(waiting),
      });
      if (!confirmed) return;
      setProblem(null);
      send.mutate();
    };
    return (
      <div className="flex flex-col gap-3">
        <p>
          {waiting === 0
            ? copy.none
            : copy.pending(people, waiting === 1 ? "has" : "have")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={ButtonVariant.Default}
            disabled={!active || waiting === 0}
            busy={send.isPending}
            aria-describedby={blocked ? blockedId : undefined}
            onClick={() => void ask()}
          >
            Notify {people}
          </Button>
          {blocked && (
            <span id={blockedId} className="text-fg-muted">
              {KORA_NOTIFY_NEEDS_ACTIVE}
            </span>
          )}
          <InlineError message={problem} />
        </div>
      </div>
    );
  };

  return (
    <Panel title={copy.heading} className="col-span-12 @4xl:col-span-6">
      <ContentState
        loading={project.isPending}
        skeleton={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-control w-44" />
          </div>
        }
        errorTitle=""
      >
        {project.data ? (
          body(project.data)
        ) : (
          // The project status panel above reports the failed load.
          <PanelNote>
            Who is waiting is unknown until the project status loads.
          </PanelNote>
        )}
      </ContentState>
    </Panel>
  );
}
