import type { PreviewNotificationPlanDto } from "@alliance/shared/client";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Button, { ButtonVariant } from "../../../ui/Button";

/**
 * What saving the group sends, from the server's dry run over the next 30
 * days (`tentativePlansForGroup`). The dry run doesn't know the group's past
 * sends, so for an edit it counts members the group already reached too.
 */
export function TentativePlanNote({
  plans,
  error,
  editing,
  onRetry,
}: {
  plans: PreviewNotificationPlanDto[] | null;
  error: string | null;
  editing: boolean;
  onRetry: () => void;
}) {
  if (plans === null) {
    return error ? (
      <span className="flex items-center gap-2">
        <span className="text-danger">{error}</span>
        <Button
          size="small"
          variant={ButtonVariant.Default}
          aria-label="Retry recipient count"
          onClick={onRetry}
        >
          Retry
        </Button>
      </span>
    ) : (
      <span>Counting recipients…</span>
    );
  }
  const first = plans.reduce<string | null>(
    (earliest, plan) =>
      earliest === null || plan.scheduledFor < earliest
        ? plan.scheduledFor
        : earliest,
    null,
  );
  const lead = editing ? "These settings plan" : "This sends";
  if (first === null) {
    return <span>{lead} no reminders in the next 30 days.</span>;
  }
  const due = new Date(first).getTime() <= Date.now();
  return (
    <span className="text-fg">
      {lead}{" "}
      <strong className="font-semibold">
        {countOf(plans.length, "reminder")}
      </strong>{" "}
      to real members in the next 30 days, the first{" "}
      {formatDateTime(first, { timeZone: LAUNCH_TIME_ZONE })}
      {due &&
        !editing &&
        ", which is already due, so it goes out within minutes"}
      .
      {editing &&
        " The count includes members the group already reached, who aren't sent it again."}
    </span>
  );
}
