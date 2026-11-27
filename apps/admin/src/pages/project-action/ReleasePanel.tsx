import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ActionPhase } from "../../lib/actionPhase";
import { ActionEditorSection } from "../../lib/staffTestingGate";
import {
  suiteLoadError,
  useActionSuiteAdmin,
} from "../../lib/useActionSuiteAdmin";
import {
  CommunicationsSection,
  communicationsPath,
} from "../action-dashboard/workspaceLocation";
import { UnsavedNotice } from "./PhaseHeader";
import ScheduledReleaseEditor from "./ScheduledReleaseEditor";
import ScheduleReleaseForm from "./ScheduleReleaseForm";

const SuiteRelease = ({
  action,
  suiteId,
  phase,
  disabled,
}: {
  action: ParsedActionDto;
  suiteId: number;
  phase: ActionPhase;
  disabled: boolean;
}) => {
  const { suite } = useActionSuiteAdmin(suiteId);
  if (suite.isPending) return <p className="text-sm">Loading suite…</p>;
  if (suite.isError) {
    return (
      <p className="text-sm text-red-600">{suiteLoadError(suite.error)}</p>
    );
  }
  if (suite.data.actions.some(({ id }) => id !== action.id)) {
    return (
      <p className="text-sm text-zinc-700">
        This action shares its suite with other actions, so scheduling it here
        would move them too.{" "}
        <Link to={`/suites/${suiteId}`} className="text-blue-600 underline">
          Schedule it from the suite page
        </Link>
        .
      </p>
    );
  }
  const withNotice = (control: ReactNode) => (
    <div className="flex flex-col gap-3">
      {disabled && <UnsavedNotice />}
      {control}
    </div>
  );
  switch (phase) {
    case ActionPhase.Draft:
      return (
        <p className="text-sm text-zinc-600">
          Start staff testing to schedule the release.
        </p>
      );
    case ActionPhase.StaffTesting:
      return withNotice(
        <ScheduleReleaseForm action={action} disabled={disabled} />,
      );
    case ActionPhase.Scheduled:
    case ActionPhase.Live:
    case ActionPhase.Closed:
      return withNotice(
        <ScheduledReleaseEditor
          key={action.events.map(({ id, date }) => `${id}:${date}`).join()}
          action={action}
          disabled={disabled}
        />,
      );
    default:
      throw new Error(`unknown phase: ${phase satisfies never}`);
  }
};

const UNSCHEDULED: Record<ActionPhase, boolean> = {
  [ActionPhase.Draft]: true,
  [ActionPhase.StaffTesting]: true,
  [ActionPhase.Scheduled]: false,
  [ActionPhase.Live]: false,
  [ActionPhase.Closed]: false,
};

const ReleasePanel = (props: {
  action: ParsedActionDto;
  phase: ActionPhase;
  disabled: boolean;
}) => {
  const suiteId = props.action.suite?.id;
  if (suiteId === undefined && !UNSCHEDULED[props.phase]) return null;
  return (
    <Card style={CardStyle.White} id={ActionEditorSection.Release}>
      <h2 className="mb-3 text-lg font-semibold">Release</h2>
      {suiteId === undefined ? (
        <p className="text-sm text-zinc-700">
          This action has no suite. Schedule it from{" "}
          <Link
            to={communicationsPath(
              props.action.id,
              CommunicationsSection.Events,
            )}
            className="text-blue-600 underline"
          >
            Events
          </Link>
          .
        </p>
      ) : (
        <SuiteRelease {...props} suiteId={suiteId} />
      )}
    </Card>
  );
};

export default ReleasePanel;
