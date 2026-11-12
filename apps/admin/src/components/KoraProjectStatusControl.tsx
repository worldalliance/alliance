import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { CirclePlay, Hourglass, Lock, type LucideIcon } from "lucide-react";
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
  { label: string; Icon: LucideIcon; description: string; confirm: string }
> = {
  [KoraProjectStatus.Pending]: {
    label: "Pending",
    Icon: Hourglass,
    description: "Waitlist period, notify about launch",
    confirm: "The project page shows the waitlist, and people can sign up.",
  },
  [KoraProjectStatus.Active]: {
    label: "Active",
    Icon: CirclePlay,
    description: "Accepting reviews",
    confirm: "Reviewers start getting transcripts to review.",
  },
  [KoraProjectStatus.Closed]: {
    label: "Closed",
    Icon: Lock,
    description: "Sign-up closed, thank participants",
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
  const activeBlocked = !project.data.canActivate;
  return (
    <fieldset className="max-w-3xl space-y-2 text-sm">
      <legend className="font-semibold mb-1">Project status</legend>
      <div className="flex divide-x divide-zinc-300 overflow-hidden rounded-md border border-zinc-300">
        {STATUSES.map((status) => {
          const { label, Icon, description } = STATUS[status];
          const blocked = status === KoraProjectStatus.Active && activeBlocked;
          return (
            <label
              key={status}
              className="flex flex-1 cursor-pointer flex-col gap-1 bg-white px-4 py-3 font-medium text-zinc-700 hover:bg-zinc-50 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:text-zinc-400 has-[:disabled]:hover:bg-white has-[:focus-visible]:relative has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-inset"
            >
              <input
                type="radio"
                name="kora-project-status"
                className="sr-only"
                checked={current === status}
                disabled={blocked || setStatus.isPending}
                aria-describedby={
                  blocked ? "kora-status-blocked" : `kora-status-${status}`
                }
                onChange={() => setTarget(status)}
              />
              <span className="flex items-center gap-2 text-base">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </span>
              <span id={`kora-status-${status}`} className="font-normal">
                {description}
              </span>
            </label>
          );
        })}
      </div>
      {activeBlocked && current !== KoraProjectStatus.Active && (
        <p id="kora-status-blocked" className="text-zinc-600">
          {KORA_ACTIVE_NEEDS_TRANSCRIPTS}
        </p>
      )}
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
