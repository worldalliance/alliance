import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { useId, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useKoraProjectAdmin,
  useSetKoraProjectStatus,
} from "../../lib/useKoraParticipantsAdmin";
import InlineError from "../../ui/InlineError";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";

// Each `confirm` says what the server does on the change: sign-up is refused
// only while Closed, and a reviewer is given transcripts only while Active,
// though one already in an assignment can finish it in any status.
const STATUS: Record<
  KoraProjectStatus,
  { label: string; description: string; confirm: string }
> = {
  [KoraProjectStatus.Pending]: {
    label: "Pending",
    description: "Waitlist period, notify about launch",
    confirm:
      "The project page shows the waitlist, and people can sign up. No new assignments start; a reviewer already in one can finish it.",
  },
  [KoraProjectStatus.Active]: {
    label: "Active",
    description: "Accepting reviews",
    confirm:
      "Reviewers start getting transcripts to review. No one is notified until you send a notice.",
  },
  [KoraProjectStatus.Closed]: {
    label: "Closed",
    description: "Sign-up closed, thank participants",
    confirm:
      "Sign-up closes, and the project page tells everyone the project has closed. No new assignments start; a reviewer already in one can finish it.",
  },
};

const STATUSES = Object.values(KoraProjectStatus);

export function ProjectStatusPanel() {
  const project = useKoraProjectAdmin();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const setStatus = useSetKoraProjectStatus({
    onSuccess: () => undefined,
    onError: (error) =>
      setProblem(
        adminRefusalMessage(error, "Couldn't change the project status."),
      ),
  });

  const change = async (status: KoraProjectStatus) => {
    const { label, confirm: message } = STATUS[status];
    const confirmed = await confirm({
      title: `Make the project ${label}?`,
      message,
      confirmLabel: `Make ${label}`,
    });
    if (!confirmed) return;
    setProblem(null);
    setStatus.mutate(status, {
      onSuccess: () => success(`Project is now ${label}`),
    });
  };

  const current = project.data?.status;
  const activeBlocked =
    project.data !== undefined &&
    !project.data.canActivate &&
    current !== KoraProjectStatus.Active;
  const blockedId = `${id}-blocked`;

  return (
    <Panel title="Project status">
      <ContentState
        things="the project status"
        query={project}
        refreshBanner={false}
        skeleton={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <div className="min-h-lh" />
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <RefreshFailedBanner
            things="the project status"
            query={project}
            inline
          />
          <fieldset className="min-w-0">
            <legend className="sr-only">Project status</legend>
            <div className="grid gap-3 @2xl:grid-cols-3">
              {STATUSES.map((status) => {
                const { label, description } = STATUS[status];
                const blocked =
                  status === KoraProjectStatus.Active && activeBlocked;
                return (
                  <label
                    key={status}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line-control bg-surface p-3 has-checked:border-accent has-checked:bg-accent-soft has-disabled:cursor-not-allowed has-disabled:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-accent"
                  >
                    <input
                      type="radio"
                      name={`${id}-status`}
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                      checked={current === status}
                      disabled={blocked || setStatus.isPending}
                      aria-describedby={blocked ? blockedId : `${id}-${status}`}
                      onChange={() => void change(status)}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{label}</span>
                      <span
                        id={`${id}-${status}`}
                        className="text-caption text-fg-muted"
                      >
                        {description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {/* One line always, so a reason or a failure moves nothing under it. */}
          <div className="min-h-lh">
            {problem ? (
              <InlineError message={problem} />
            ) : (
              activeBlocked && (
                <p id={blockedId} className="text-fg-muted">
                  {KORA_ACTIVE_NEEDS_TRANSCRIPTS}
                </p>
              )
            )}
          </div>
        </div>
      </ContentState>
    </Panel>
  );
}
