import type {
  ActionEventDto,
  ActionSuiteDto,
  CreateActionEventDto,
  ReminderGroupDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import { useRef, useState } from "react";
import { Link } from "react-router";
import CreateEventForm from "../../components/CreateEventForm";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { suiteHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { TabParam } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import PhaseBadge, { phaseLabel } from "../../ui/PhaseBadge";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { EditSuiteEventDialog } from "./EditSuiteEventDialog";
import { deletePhases, phaseChangeText } from "./suiteEventRules";

const pacific = (date: string) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

/**
 * Each task's copy of a shared event: the server deletes or edits, on every
 * task, the suite-managed event at the same place in its date order.
 */
const copiesOf = (suite: ActionSuiteDto, event: ActionEventDto) => {
  const byDate = (events: readonly ActionEventDto[]) =>
    events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const index = byDate(suite.actions[0]?.events ?? []).findIndex(
    (own) => own.id === event.id,
  );
  return new Set(
    suite.actions.flatMap((action) => {
      const copy = byDate(action.events)[index];
      return copy?.suiteManaged && copy.newStatus === event.newStatus
        ? [copy.id]
        : [];
    }),
  );
};

const DEADLINE_TIMED = new Set<ReminderGroupDto["timingMode"]>([
  "from_deadline",
  "within_relative_range",
]);

/**
 * The reminder groups a delete takes: those on a copy of the event are deleted
 * with it, and unsent ones with a copy as their deadline lose it. The suite
 * doesn't load timing anchors, and an anchored group keeps sending.
 */
const remindersOn = (suite: ActionSuiteDto, event: ActionEventDto) => {
  const copies = copiesOf(suite, event);
  const deleted = suite.reminderGroups.filter((group) =>
    copies.has(group.memberActionEvent.id),
  );
  const stopped = suite.reminderGroups.filter(
    (group) =>
      !deleted.includes(group) &&
      !group.allSent &&
      DEADLINE_TIMED.has(group.timingMode) &&
      group.deadlineEvent !== undefined &&
      copies.has(group.deadlineEvent.id),
  );
  return { deleted: deleted.length, stopped: stopped.length };
};

/**
 * The suite's shared events, each saved on every task in it. A refused delete
 * goes to `deleteEvent`'s caller, which shows it as the page's banner.
 */
export function SuiteEventsTab({
  suite,
  addEvent,
  updateEvent,
  deleteEvent,
}: {
  suite: ActionSuiteDto;
  /** Resolves `null` when staff decline to move the deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  updateEvent: (
    eventId: number,
    body: UpdateActionEventDto,
  ) => Promise<ActionSuiteDto | null>;
  /** Resolves whether the event was deleted. */
  deleteEvent: (eventId: number) => Promise<boolean>;
}) {
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [editing, setEditing] = useState<ActionEventDto | null>(null);
  const [adding, setAdding] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const now = new Date();
  const events = suite.events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const addRef = useRef<HTMLButtonElement>(null);
  const removal = useFocusAfterRemoval({
    ids: events.map((event) => event.id),
    fallback: addRef,
  });
  const tasks =
    suite.actions.length === 1
      ? "this suite's one task"
      : `all ${countOf(suite.actions.length, "task")} in this suite`;

  const remove = async (event: ActionEventDto) => {
    const reminders = remindersOn(suite, event);
    const phases = deletePhases({
      event,
      events: suite.events,
      now: new Date(),
    });
    const message = [
      `Deletes this event from ${tasks}.`,
      reminders.deleted > 0 &&
        `The suite's ${countOf(reminders.deleted, "reminder")} on it ${reminders.deleted === 1 ? "is" : "are"} deleted with it, and nothing more of ${reminders.deleted === 1 ? "it" : "them"} is sent.`,
      reminders.stopped > 0 &&
        `The suite's ${countOf(reminders.stopped, "reminder")} with it as ${reminders.stopped === 1 ? "its" : "their"} deadline stop${reminders.stopped === 1 ? "s" : ""} sending, unless timed from a dependency task's deadline.`,
      phases.from !== phases.to && phaseChangeText(phases),
    ]
      .filter(Boolean)
      .join("\n");
    if (
      await confirm({
        title: `Delete “${event.title || phaseLabel(event.newStatus)}” for every task?`,
        message,
        confirmLabel: "Delete event",
        destructive: true,
      })
    ) {
      const focusNext = removal.removing(event.id);
      if (await deleteEvent(event.id)) focusNext();
    }
  };

  return (
    <div className="flex flex-col gap-section">
      <Panel
        title="Shared events"
        description={`Saved on ${tasks}`}
        flush={events.length > 0}
        action={
          <Button
            ref={addRef}
            size="small"
            variant={ButtonVariant.Default}
            aria-expanded={adding}
            onClick={() => setAdding(true)}
          >
            Add event
          </Button>
        }
      >
        {events.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>State</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const name = event.title || phaseLabel(event.newStatus);
                return (
                  <TableRow key={event.id} {...removal.row(event.id)}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <PhaseBadge status={event.newStatus} />
                        {name !== phaseLabel(event.newStatus) && (
                          <span
                            className="max-w-40 truncate font-medium"
                            title={name}
                          >
                            {name}
                          </span>
                        )}
                      </span>
                      {event.description && (
                        <span
                          className="mt-1 block max-w-36 truncate text-fg-muted"
                          title={event.description}
                        >
                          {event.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {pacific(event.date)}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {new Date(event.date) <= now ? "Passed" : "Upcoming"}
                    </TableCell>
                    <TableCell actions>
                      <Button
                        size="small"
                        variant={ButtonVariant.Default}
                        aria-label={`Edit…: ${name}`}
                        onClick={() => setEditing(event)}
                      >
                        Edit…
                      </Button>
                      <Button
                        size="small"
                        variant={ButtonVariant.Ghost}
                        aria-label={`Delete: ${name}`}
                        onClick={() => void remove(event)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No shared events yet"
            description="Launching the suite creates its members taking action and office taking action events, after its checks."
            action={
              <Link
                to={`${suiteHref(suite.id)}?${TabParam.Tab}=launch`}
                className={linkClass}
              >
                Go to launch
              </Link>
            }
          />
        )}
      </Panel>
      {adding && (
        <Panel
          title="Add an event to every task"
          description="Outside the launch, with no launch checks"
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              disabled={creatingEvent}
              onClick={() => setAdding(false)}
            >
              Close
            </Button>
          }
        >
          <CreateEventForm
            suiteMode
            addToSuite={addEvent}
            creatingEvent={creatingEvent}
            setCreatingEvent={setCreatingEvent}
            eventCreatedSuccess={false}
            setEventCreatedSuccess={(added) => {
              if (!added) return;
              success("Event added");
              setAdding(false);
            }}
          />
        </Panel>
      )}
      {editing && (
        <EditSuiteEventDialog
          suite={suite}
          event={editing}
          updateEvent={updateEvent}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
