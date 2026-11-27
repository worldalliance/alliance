import type {
  ActionEventDto,
  ActionUpdateDto,
  TagDto,
} from "@alliance/shared/client";
import { useCallback, useMemo } from "react";
import { suiteHref } from "../../../lib/hrefs";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Panel } from "../../../ui/templates/Overview";
import type { TaskTabProps } from "../taskTabs";
import { NewUpdateForm } from "./NewUpdateForm";
import { UpdateList } from "./UpdateList";

const NEW_UPDATE_FORM_ID = "new-project-update";

/**
 * The task's project updates. Reminders and follow-up forms are other kinds
 * of message with their own screens and confirmations, so this tab only
 * points to them.
 */
export function MessagesTab({
  task,
  lookups,
  openTab,
  setError,
}: TaskTabProps) {
  return (
    <TaskMessages
      actionId={task.id}
      updates={task.updates ?? []}
      events={task.events ?? []}
      tags={lookups.availableTags}
      suiteId={task.suite?.id ?? null}
      openFollowUpForms={() => openTab("follow-up-forms")}
      setError={setError}
    />
  );
}

export function TaskMessages({
  actionId,
  updates,
  events,
  tags,
  suiteId,
  openFollowUpForms,
  setError,
}: {
  actionId: number;
  updates: ActionUpdateDto[];
  events: ActionEventDto[];
  tags: TagDto[];
  suiteId: number | null;
  openFollowUpForms: () => void;
  setError: (message: string | null) => void;
}) {
  const newestFirst = useMemo(
    () => [...updates].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [updates],
  );
  const focusNewTitle = useCallback(
    () =>
      document
        .querySelector<HTMLElement>(`#${NEW_UPDATE_FORM_ID} input`)
        ?.focus(),
    [],
  );
  return (
    <>
      <UpdateList
        actionId={actionId}
        updates={newestFirst}
        setError={setError}
        focusAfterLast={focusNewTitle}
      />
      <NewUpdateForm
        actionId={actionId}
        events={events}
        tags={tags}
        formId={NEW_UPDATE_FORM_ID}
      />
      <Panel title="Other messages about this task">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 className="font-medium">Reminders</h3>
              <p className="text-fg-muted">
                {suiteId !== null
                  ? "Sent by the reminder groups of the task's suite, which you create and edit there."
                  : "Reminders are created on a suite's Reminders tab, and this task isn't in a suite now. Reminder groups made while it was in one keep sending."}
              </p>
            </div>
            {suiteId !== null && (
              <Button
                size="small"
                variant={ButtonVariant.Default}
                to={`${suiteHref(suiteId)}?tab=reminders`}
              >
                Open the suite&apos;s reminders
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 className="font-medium">Follow-up forms</h3>
              <p className="text-fg-muted">
                Forms a cohort is asked to fill in between set dates, on the
                Follow-up forms tab.
              </p>
            </div>
            <Button
              size="small"
              variant={ButtonVariant.Default}
              onClick={openFollowUpForms}
            >
              Open follow-up forms
            </Button>
          </div>
        </div>
      </Panel>
    </>
  );
}
