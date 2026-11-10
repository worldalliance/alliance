import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useKoraProjectAdmin,
  useSetKoraProjectStatus,
} from "../lib/useKoraParticipantsAdmin";
import ConfirmDialog from "./ConfirmDialog";

const STATUS: Record<
  KoraProjectStatus,
  { label: string; description: string; confirm: string }
> = {
  [KoraProjectStatus.Pending]: {
    label: "Pending",
    description: "The project page shows the waitlist.",
    confirm: "The project page shows the waitlist, and people can sign up.",
  },
  [KoraProjectStatus.Active]: {
    label: "Active",
    description: "Reviewers get transcripts to review.",
    confirm: "Reviewers start getting transcripts to review.",
  },
  [KoraProjectStatus.Closed]: {
    label: "Closed",
    description:
      "Sign-up closes, and the project page thanks everyone who took part.",
    confirm:
      "Sign-up closes, and the project page tells everyone the project has closed.",
  },
};

const STATUSES = Object.values(KoraProjectStatus);

export function KoraProjectStatusControl() {
  const project = useKoraProjectAdmin();
  const toast = useToast();
  const [target, setTarget] = useState<KoraProjectStatus | null>(null);
  const setStatus = useSetKoraProjectStatus({
    onSuccess: () => {
      if (target) toast.success(`Project is now ${STATUS[target].label}`);
      setTarget(null);
    },
    onError: (err) => {
      toast.error(
        adminRefusalMessage(err, "Couldn't change the status. Try again."),
      );
      setTarget(null);
      console.error(err);
    },
  });

  if (project.isPending) {
    return <p className="text-sm">Loading project status…</p>;
  }
  if (project.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {adminRefusalMessage(
          project.error,
          "Couldn't load the project status. Reload to try again.",
        )}
      </p>
    );
  }

  const current = project.data.status;
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-semibold mb-1">Project status</legend>
      {STATUSES.map((status) => {
        const blocked =
          status === KoraProjectStatus.Active && !project.data.canActivate;
        return (
          <label key={status} className="flex items-start gap-2">
            <input
              type="radio"
              name="kora-project-status"
              className="mt-1"
              checked={current === status}
              disabled={blocked || setStatus.isPending}
              aria-describedby={`kora-status-${status}`}
              onChange={() => setTarget(status)}
            />
            <span>
              <span className="font-medium">{STATUS[status].label}</span>
              <span
                id={`kora-status-${status}`}
                className="block text-zinc-600"
              >
                {blocked
                  ? KORA_ACTIVE_NEEDS_TRANSCRIPTS
                  : STATUS[status].description}
              </span>
            </span>
          </label>
        );
      })}
      <ConfirmDialog
        isOpen={target !== null}
        title={target ? `Make the project ${STATUS[target].label}?` : ""}
        message={target ? STATUS[target].confirm : ""}
        confirmLabel={target ? `Make ${STATUS[target].label}` : undefined}
        isLoading={setStatus.isPending}
        onConfirm={() => target && setStatus.mutate(target)}
        onCancel={() => setTarget(null)}
      />
    </fieldset>
  );
}
