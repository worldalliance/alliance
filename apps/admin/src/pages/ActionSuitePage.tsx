import { UpdateActionEventDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { milliseconds } from "date-fns";
import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import ActionListCard from "../components/ActionListCard";
import ActionTimeline from "../components/ActionTimeline";
import GeneralUpdateCard from "../components/GeneralUpdateCard";
import ActionRemindersTab from "../components/reminders/ActionRemindersTab";
import SuiteLaunchPanel from "../components/suite-launch/SuiteLaunchPanel";
import SuiteEventList from "../components/SuiteEventList";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  suiteLoadError,
  useActionSuiteAdmin,
} from "../lib/useActionSuiteAdmin";

const ActionSuitePage = () => {
  const { suiteId: suiteIdString } = useParams();
  const suiteId = Number(suiteIdString);

  const [error, setError] = useState<string | null>(null);
  const {
    suite: suiteQuery,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useActionSuiteAdmin(suiteId);
  const navigate = useNavigate();

  const [launchOpen, setLaunchOpen] = useState(false);
  const [highlightedReminder, setHighlightedReminder] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (highlightedReminder) {
      setTimeout(
        () => {
          setHighlightedReminder(null);
        },
        milliseconds({ seconds: 2 }),
      );
    }
  }, [highlightedReminder]);

  const handleHighlightReminder = (reminderId: number) => {
    setHighlightedReminder(reminderId);
  };

  const suite = suiteQuery.data;
  if (!suite) {
    return suiteQuery.isError ? (
      <p className="p-6 text-red-500">{suiteLoadError(suiteQuery.error)}</p>
    ) : (
      <div>Loading...</div>
    );
  }

  const handleEditEvent = (eventId: number, body: UpdateActionEventDto) => {
    updateEvent.mutate(
      { eventId, body },
      {
        onError: (e) =>
          setError(adminRefusalMessage(e, "Failed to update event")),
      },
    );
  };

  const handleDeleteEvent = (eventId: number) => {
    deleteEvent.mutate(eventId, {
      onError: (e) =>
        setError(
          adminRefusalMessage(e, "Failed to delete event") +
            " (events will fail to delete if reminders depend on their existence)",
        ),
    });
  };
  if (suite.actions.length === 0) {
    return (
      <div className="p-6 flex flex-col gap-6 items-center justify-center h-screen">
        <p>Suite: {suite.name}</p>
        <p className="text-sm text-zinc-500">No actions yet</p>
        <Button
          color={ButtonColor.Black}
          onClick={() => {
            navigate(`/actions/new?suiteId=${suiteId}`);
          }}
        >
          Add new action
        </Button>
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
      {launchOpen ? (
        <SuiteLaunchPanel
          suite={suite}
          addEvent={addEvent.mutateAsync}
          onClose={() => setLaunchOpen(false)}
        />
      ) : (
        !suite.events.some((event) => event.newStatus === "member_action") && (
          <Button
            color={ButtonColor.Green}
            size="large"
            className="self-start gap-2 text-lg"
            onClick={() => setLaunchOpen(true)}
          >
            <Rocket className="size-5" />
            Begin launch process
          </Button>
        )
      )}
      <SuiteEventList
        addToSuite={addEvent.mutateAsync}
        events={suite.events}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
      <Card className="!p-0">
        <div className="p-3 border-b border-zinc-200 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">General updates</h2>
          <Button
            color={ButtonColor.Black}
            onClick={() => navigate(`/general-updates/new?suiteId=${suiteId}`)}
          >
            Create general update
          </Button>
        </div>
        {(suite.generalUpdates?.length ?? 0) > 0 ? (
          <div className="divide-y divide-zinc-100">
            {(suite.generalUpdates ?? []).map((update) => (
              <GeneralUpdateCard
                key={update.id}
                update={update}
                navigate={navigate}
              />
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-500">
            No general updates for this suite yet.
          </p>
        )}
      </Card>
      {error && <p className="text-red-500">{error}</p>}
      <div className="space-y-5 flex-1 overflow-y-auto pt-0">
        <p className="text-sm text-gray-500">Actions ordered by priority</p>
        {suite?.actions
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((action) => (
            <Card key={action.id} className="!p-0">
              <ActionListCard action={action} />
            </Card>
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
