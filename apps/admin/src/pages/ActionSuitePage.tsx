import {
  actionsBatchUpdateSuiteEvents,
  actionsDeleteSuiteEvent,
  actionsSuite,
  ActionSuiteDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import ActionListCard from "../components/ActionListCard";
import ActionRemindersTab from "../components/ActionRemindersTab";
import ActionTimeline from "../components/ActionTimeline";
import SuiteEventList from "../components/SuiteEventList";

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

  console.log(suite);

  const handleEditEvent = (eventId: number, body: UpdateActionEventDto) => {
    actionsBatchUpdateSuiteEvents({ path: { suiteId, eventId }, body }).then(
      (resp) => {
        if (resp.data) {
          setSuite(resp.data as ActionSuiteDto);
        } else {
          setError((resp.error as Error).message as string);
        }
      }
    );
  };

  const handleDeleteEvent = (eventId: number) => {
    actionsDeleteSuiteEvent({ path: { suiteId, eventId } }).then((resp) => {
      if (resp.data) {
        setSuite(resp.data);
      } else {
        setError(
          ((resp.error as Error).message as string) +
            " (events will fail to delete if reminders depend on their existence)"
        );
      }
    });
  };
  if (suite.actions.length === 0) {
    return (
      <div className="p-6 flex flex-col gap-6 items-center justify-center h-screen">
        <p>Suite: {suite.name}</p>
        <p className="text-sm text-zinc-500">
          Add an action to the suite to begin managing events & reminders
        </p>
      </div>
    );
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
      <SuiteEventList
        referenceAction={suite.actions[0]}
        setSuite={setSuite}
        suiteId={suiteId}
        events={suite.events}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
      {error && <p className="text-red-500">{error}</p>}
      <div className="space-y-5 flex-1 overflow-y-auto pt-0">
        <p className="text-sm text-gray-500">Actions ordered by priority</p>
        {suite?.actions
          .sort((a, b) => b.priority - a.priority)
          .map((action) => (
            <ActionListCard key={action.id} action={action} totalUsers={0} />
          ))}
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
