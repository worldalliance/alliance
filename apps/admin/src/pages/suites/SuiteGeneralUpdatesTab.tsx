import type { ActionSuiteDto } from "@alliance/shared/client";
import { useNavigate } from "react-router";
import GeneralUpdateCard from "../../components/GeneralUpdateCard";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Panel } from "../../ui/templates/Overview";

/** The general updates sent with the suite. */
export function SuiteGeneralUpdatesTab({ suite }: { suite: ActionSuiteDto }) {
  const navigate = useNavigate();
  const newUpdateHref = `/content/general-updates/new?suiteId=${suite.id}`;
  return (
    <Panel
      title="General updates"
      flush
      action={
        <Button size="small" variant={ButtonVariant.Default} to={newUpdateHref}>
          Create general update
        </Button>
      }
    >
      {suite.generalUpdates.length > 0 ? (
        <div className="divide-y divide-line">
          {suite.generalUpdates.map((update) => (
            <GeneralUpdateCard
              key={update.id}
              update={update}
              navigate={navigate}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No general updates for this suite yet" />
      )}
    </Panel>
  );
}
