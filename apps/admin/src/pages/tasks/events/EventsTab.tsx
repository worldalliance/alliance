import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import { useRef, useState } from "react";
import { Link } from "react-router";
import {
  dataOrThrow,
  sendConfirmingDeadlineShortening,
} from "../../../lib/confirmDeadlineShortening";
import { formatDateTime } from "../../../lib/formatDate";
import { suiteHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../../ui/Button";
import { timeZoneLabel } from "../../../ui/DateTimePicker";
import { EmptyState } from "../../../ui/EmptyState";
import PhaseBadge from "../../../ui/PhaseBadge";
import { linkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Banner } from "../../../ui/templates/Banner";
import { Panel } from "../../../ui/templates/Overview";
import { useToast } from "../../../ui/ToastProvider";
import { taskVisibility } from "../taskFacts";
import type { TaskTabProps } from "../taskTabs";
import { AddEventForm } from "./AddEventForm";
import { EventTargetKind } from "./eventRules";
import type { SendEvent } from "./useAddEvent";

/**
 * The task's events, newest first, and a guarded way to add one. A task's own
 * events have no edit or delete: a date moved into the past launches.
 */
export function EventsTab({
  task,
  admin,
}: {
  task: Pick<
    TaskTabProps["task"],
    | "events"
    | "suite"
    | "archived"
    | "publicOnly"
    | "staffPreview"
    | "visibilityMode"
  >;
  admin: Pick<TaskTabProps["admin"], "addEvent">;
}) {
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const formArea = useRef<HTMLDivElement>(null);
  const events = sortByDateDescending(task.events);
  const suite = task.suite;
  const suiteTab = (tab: string) =>
    suite ? `${suiteHref(suite.id)}?tab=${tab}` : "";

  const send: SendEvent = async (body) =>
    dataOrThrow(
      await sendConfirmingDeadlineShortening({
        send: (query) => admin.addEvent({ body, ...query }),
        confirm,
      }),
    ) !== null;

  const close = () => {
    setAdding(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };

  return (
    <>
      {suite && (
        <Banner inline>
          This task is in the suite {suite.name}, so it usually launches from
          the suite's{" "}
          <Link className={linkClass} to={suiteTab("launch")}>
            Launch tab
          </Link>{" "}
          and its dates change in the suite's{" "}
          <Link className={linkClass} to={suiteTab("events")}>
            events
          </Link>
          , for every task at once. An event added here changes this task only.
        </Banner>
      )}
      {adding && (
        <div ref={formArea}>
          <AddEventForm
            target={{ kind: EventTargetKind.Task, task }}
            send={send}
            onDiscard={close}
            onAdded={(body) => {
              success("Event added", body.title);
              close();
            }}
          />
        </div>
      )}
      <Panel
        title="Events"
        description={`Times in ${timeZoneLabel(LAUNCH_TIME_ZONE)}`}
        flush
        action={
          !adding && (
            <Button
              ref={addButton}
              variant={ButtonVariant.Default}
              size="small"
              onClick={() => {
                setAdding(true);
                requestAnimationFrame(() =>
                  formArea.current?.querySelector("select")?.focus(),
                );
              }}
            >
              Add event
            </Button>
          )
        }
      >
        {events.length === 0 ? (
          <EmptyState
            title="No events yet"
            description={`With no events the task is a draft. As a draft it is seen by: ${taskVisibility(task).asDraft.toLowerCase()}.`}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status from then</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Set by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell
                    truncate
                    title={
                      event.description
                        ? `${event.title}: ${event.description}`
                        : event.title
                    }
                  >
                    <span className="font-medium">{event.title}</span>
                    {event.description && (
                      <span className="text-fg-muted">
                        {" "}
                        · {event.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PhaseBadge status={event.newStatus} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(event.date, {
                      weekday: true,
                      timeZone: LAUNCH_TIME_ZONE,
                    })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {event.suiteManaged && suite ? (
                      <Link className={linkClass} to={suiteTab("events")}>
                        The suite
                      </Link>
                    ) : event.suiteManaged ? (
                      "A suite"
                    ) : (
                      "This task"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
