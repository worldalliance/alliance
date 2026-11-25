import type { ActionSuiteDto } from "@alliance/shared/client";
import ActionListCard from "../../components/ActionListCard";
import Button, { ButtonVariant } from "../../ui/Button";
import { Panel } from "../../ui/templates/Overview";

/** The suite's tasks, highest priority first. */
export function SuiteTasksTab({
  suite,
  newTaskHref,
}: {
  suite: ActionSuiteDto;
  newTaskHref: string;
}) {
  return (
    <Panel
      title="Tasks"
      description="By priority"
      flush
      action={
        <Button size="small" variant={ButtonVariant.Default} to={newTaskHref}>
          New task
        </Button>
      }
    >
      <div className="divide-y divide-line">
        {suite.actions
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((action) => (
            <ActionListCard key={action.id} action={action} />
          ))}
      </div>
    </Panel>
  );
}
