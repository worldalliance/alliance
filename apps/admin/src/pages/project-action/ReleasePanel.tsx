import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { Link } from "react-router";
import { ActionPhase } from "../../lib/actionPhase";
import { ActionEditorSection } from "../../lib/staffTestingGate";
import {
  suiteLoadError,
  useActionSuiteAdmin,
} from "../../lib/useActionSuiteAdmin";
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
  switch (phase) {
    case ActionPhase.Draft:
      return (
        <p className="text-sm text-zinc-600">
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
};

const ReleasePanel = (props: {
  action: ParsedActionDto;
  phase: ActionPhase;
  disabled: boolean;
}) => {
  const suiteId = props.action.suite?.id;
  return (
    <Card style={CardStyle.White} id={ActionEditorSection.Release}>
      <h2 className="mb-3 text-lg font-semibold">Release</h2>
      {suiteId === undefined ? (
        <p className="text-sm text-zinc-700">
          This action has no suite. Schedule it from{" "}
          <Link
            to={`/actions/${props.action.id}?tab=events`}
            className="text-blue-600 underline"
          >
            Event Management
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
