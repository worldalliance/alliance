import { errorMessage } from "@alliance/common/errorMessage";
import {
  actionsBatchUpdateSuiteEventsAdmin,
  actionsDeleteSuiteEventAdmin,
  actionsSuiteAdmin,
  ActionSuiteDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { milliseconds } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import ActionListCard from "../components/ActionListCard";
import ActionTimeline from "../components/ActionTimeline";
import GeneralUpdateCard from "../components/GeneralUpdateCard";
import ActionRemindersTab from "../components/reminders/ActionRemindersTab";
import SuiteEventList from "../components/SuiteEventList";
import { sendConfirmingDeadlineShortening } from "../lib/confirmDeadlineShortening";

const ActionSuitePage = () => {
  const { suiteId: suiteIdString } = useParams();
  const suiteId = Number(suiteIdString);

  const [error, setError] = useState<string | null>(null);
  const [suite, setSuite] = useState<ActionSuiteDto | null>(null);
  const navigate = useNavigate();
  const { confirm } = useToast();

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

  useEffect(() => {
    const fetchSuiteActions = async () => {
      const response = await actionsSuiteAdmin({ path: { id: suiteId } });
      if (response.data) {
        setSuite(response.data);
      } else {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to fetch suite",
          }),
        );
      }
    };
    fetchSuiteActions();
  }, [suiteId]);

  if (!suite) {
    return <div>Loading...</div>;
  }

  const handleEditEvent = (eventId: number, body: UpdateActionEventDto) => {
    sendConfirmingDeadlineShortening({
      send: (query) =>
        actionsBatchUpdateSuiteEventsAdmin({
          path: { suiteId, eventId },
          body,
          query,
        }),
      confirm,
    }).then((resp) => {
      if (!resp) return;
      if (resp.data) {
        setSuite(resp.data as ActionSuiteDto);
      } else {
        setError(
          errorMessage({
            error: resp.error,
            fallback: "Failed to update event",
          }),
        );
      }
    });
  };

  const handleDeleteEvent = (eventId: number) => {
    actionsDeleteSuiteEventAdmin({ path: { suiteId, eventId } }).then(
      (resp) => {
        if (resp.data) {
          setSuite(resp.data);
        } else {
          setError(
            errorMessage({
              error: resp.error,
              fallback: "Failed to delete event",
            }) +
              " (events will fail to delete if reminders depend on their existence)",
          );
        }
      },
    );
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
      <SuiteEventList
        referenceAction={suite.actions[0]}
        setSuite={setSuite}
        suiteId={suiteId}
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
