import {
  RETRY_SAVE,
  SAVE_STATUS_COPY,
  SaveStatus,
} from "@alliance/shared/lib/useNotificationSettings";
import { Check } from "lucide-react";

type Props = { status: SaveStatus | null; onRetry: () => void };

export default function SaveState({ status, onRetry }: Props) {
  switch (status) {
    case null:
      return null;
    case SaveStatus.Saving:
      return (
        <span className="text-sm text-zinc-500">
          {SAVE_STATUS_COPY[status]}
        </span>
      );
    case SaveStatus.Saved:
      return (
        <span className="flex items-center gap-1 text-sm text-zinc-500">
          <Check size={14} aria-hidden />
          {SAVE_STATUS_COPY[status]}
        </span>
      );
    case SaveStatus.Failed:
      return (
        <span role="alert" className="text-sm text-red-600">
          {SAVE_STATUS_COPY[status]}{" "}
          <button type="button" className="underline" onClick={onRetry}>
            {RETRY_SAVE}
          </button>
        </span>
      );
    default:
      throw new Error(`unknown save status: ${status satisfies never}`);
  }
}
