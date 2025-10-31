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

  const [highlightedReminder, setHighlightedReminder] = useState<number | null>(
    null
  );
  useEffect(() => {
    if (highlightedReminder) {
      setTimeout(() => {
        setHighlightedReminder(null);
      }, 2000);
    }
  }, [highlightedReminder]);

  const handleHighlightReminder = (reminderId: number) => {
    setHighlightedReminder(reminderId);
  };

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
        reminders={suite.reminderGroups}
        className="-m-6 mb-0"
        onReminderClick={handleHighlightReminder}
      />
      {error && <p className="text-red-500">{error}</p>}
      <div className="space-y-5 flex-1 overflow-y-auto pt-0">
        {suite?.actions
          .sort((a, b) => b.priority - a.priority)
          .map((action) => (
            <ActionListCard key={action.id} action={action} totalUsers={0} />
          ))}
        <p className="text-sm text-gray-500">Actions ordered by priority</p>
      </div>
      {suite && suite.actions.length > 0 && (
        <ActionRemindersTab
          suite={suite}
          highlightedReminder={highlightedReminder ?? undefined}
        />
      )}
    </div>
  );
};

export default ActionSuitePage;
