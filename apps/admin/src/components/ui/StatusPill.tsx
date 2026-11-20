import type { ActionStatus } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_TONES,
} from "../../lib/actionStatusDisplay";
import { StatusTone } from "../../lib/statusTone";

const TONE_CLASS: Record<StatusTone, string> = {
  [StatusTone.Neutral]: "bg-zinc-100 text-zinc-700",
  [StatusTone.Attention]: "bg-amber-100 text-amber-800",
  [StatusTone.Live]: "bg-blue-100 text-blue-800",
  [StatusTone.Positive]: "bg-green-100 text-green-800",
  [StatusTone.Negative]: "bg-red-100 text-red-800",
};

const StatusPill = ({ tone, label }: { tone: StatusTone; label: string }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
      TONE_CLASS[tone],
    )}
  >
    {label}
  </span>
);

export const ActionStatusPill = ({ status }: { status: ActionStatus }) => (
  <StatusPill
    tone={ACTION_STATUS_TONES[status]}
    label={ACTION_STATUS_LABELS[status]}
  />
);

export default StatusPill;
