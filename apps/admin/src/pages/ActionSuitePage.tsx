import { actionsSuite, ActionSuiteDto } from "@alliance/shared/client";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import ActionListCard from "../components/ActionListCard";
import ActionRemindersTab from "../components/ActionRemindersTab";
import ActionTimeline from "../components/ActionTimeline";

const ActionSuitePage = () => {
  const { suiteId: suiteIdString } = useParams();
  const suiteId = Number(suiteIdString);

  const [error, setError] = useState<string | null>(null);
  const [suite, setSuite] = useState<ActionSuiteDto | null>(null);

  useEffect(() => {
    const fetchSuiteActions = async () => {
      const response = await actionsSuite({ path: { id: suiteId } });
      if (response.data) {
        setSuite(response.data);
      } else {
        setError((response.error as Error).message as string);
      }
    };
    fetchSuiteActions();
  }, [suiteId]);

  if (!suite) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <ActionTimeline
        actions={suite?.actions ?? []}
        title={suite.name}
        className="-m-6 mb-0"
      />
      {error && <p className="text-red-500">{error}</p>}
      <div className="space-y-5 flex-1 overflow-y-auto pt-0">
        {suite?.actions.map((action) => (
          <ActionListCard
            key={action.id}
            action={action}
            handleEditAction={() => {}}
            totalUsers={0}
          />
        ))}
      </div>
      {suite && suite.actions.length > 0 && (
        <ActionRemindersTab action={suite.actions[0]} />
      )}
    </div>
  );
};

export default ActionSuitePage;
