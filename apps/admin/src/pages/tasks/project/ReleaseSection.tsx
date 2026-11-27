import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { Link } from "react-router";
import { ActionPhase } from "../../../lib/actionPhase";
import { suiteHref } from "../../../lib/hrefs";
import {
  suiteLoadError,
  useActionSuiteAdmin,
} from "../../../lib/useActionSuiteAdmin";
import { linkClass } from "../../../ui/styles";
import { SidePanelSection } from "../../../ui/templates/Record";
import { ScheduledReleaseEditor } from "./ScheduledReleaseEditor";
import { ScheduleReleaseForm } from "./ScheduleReleaseForm";

function SuiteRelease({
  action,
  suiteId,
  phase,
  disabled,
}: {
  action: ParsedActionDto;
  suiteId: number;
  phase: ActionPhase;
  disabled: boolean;
}) {
  const { suite } = useActionSuiteAdmin(suiteId);
  if (suite.isPending) return <p className="text-fg-muted">Loading suite…</p>;
  if (suite.isError) {
    return <p className="text-danger">{suiteLoadError(suite.error)}</p>;
  }
  if (suite.data.actions.some(({ id }) => id !== action.id)) {
    return (
      <p className="text-fg-muted">
        This task shares its suite with other tasks, so scheduling it here would
        move them too.{" "}
        <Link to={suiteHref(suiteId)} className={linkClass}>
          Schedule it from the suite page
        </Link>
        .
      </p>
    );
  }
  switch (phase) {
    case ActionPhase.Draft:
      return (
        <p className="text-fg-muted">
          Start staff testing to schedule the release.
        </p>
      );
    case ActionPhase.StaffTesting:
      return <ScheduleReleaseForm action={action} disabled={disabled} />;
    case ActionPhase.Scheduled:
    case ActionPhase.Live:
    case ActionPhase.Closed:
      return (
        <ScheduledReleaseEditor
          key={action.events.map(({ id, date }) => `${id}:${date}`).join()}
          action={action}
          disabled={disabled}
        />
      );
    default:
      throw new Error(`unknown phase: ${phase satisfies never}`);
  }
}

/** A project task's release, in the side panel. A task with no suite never shows it. */
export function ReleaseSection({
  action,
  phase,
  disabled,
  onOpenEvents,
}: {
  action: ParsedActionDto;
  phase: ActionPhase;
  disabled: boolean;
  onOpenEvents: () => void;
}) {
  const suiteId = action.suite?.id;
  return (
    <SidePanelSection title="Release">
      {suiteId === undefined ? (
        <p className="text-fg-muted">
          This task has no suite. Schedule it from{" "}
          <button type="button" className={linkClass} onClick={onOpenEvents}>
            Events
          </button>
          .
        </p>
      ) : (
        <SuiteRelease
          action={action}
          suiteId={suiteId}
          phase={phase}
          disabled={disabled}
        />
      )}
    </SidePanelSection>
  );
}
