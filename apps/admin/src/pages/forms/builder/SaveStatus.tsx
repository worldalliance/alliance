import { cn } from "../../../ui/cn";
import type { SaveStatus as Status } from "./saveStatusRules";

/** The save state, in a slot of fixed width so its text never moves the toolbar. */
export function SaveStatus({ status }: { status: Status }) {
  return (
    <p
      role={status.failed ? "alert" : "status"}
      aria-label="Save state"
      title={status.text || undefined}
      className={cn(
        "line-clamp-2 w-32 shrink-0 text-right text-caption",
        status.failed ? "text-danger" : "text-fg-muted",
      )}
    >
      {status.text}
    </p>
  );
}
