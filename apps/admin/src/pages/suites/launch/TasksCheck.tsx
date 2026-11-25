import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import { secondsInMinute } from "date-fns/constants";
import { Fragment } from "react";
import OpenReferenceWarning from "../../../components/OpenReferenceWarning";
import {
  actionChecklistDismissals,
  checklistBlocks,
  checklistDismissKeys,
  checklistKey,
  LaunchSection,
} from "../../../components/suite-launch/launchBlockers";
import type { LaunchSchedule } from "../../../components/suite-launch/launchSchedule";
import type { LaunchAction } from "../../../components/suite-launch/useSuiteLaunchData";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../../../lib/describeCohortExpression";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { referencedActionFromListItem } from "../../../lib/referencedAction";
import { useTagsAdmin } from "../../../lib/useTagsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { CheckboxField } from "../../../ui/templates/Form";
import { LaunchCheck } from "./LaunchCheck";
import { TaskLinks } from "./TaskLinks";

const readingOverEstimate = ({ action, readingSeconds }: LaunchAction) =>
  action.timeEstimate != null &&
  readingSeconds > action.timeEstimate * secondsInMinute &&
  `Reading alone takes about ${Math.ceil(readingSeconds / secondsInMinute)} min, more than its ${action.timeEstimate} min estimate`;

const taskNotes = (params: {
  entry: LaunchAction;
  changedSinceReady: boolean;
}) => {
  const { entry, changedSinceReady } = params;
  const { action, memberCount, ownMemberStart } = entry;
  return [
    ownMemberStart &&
      `Already has its own members taking action event (${formatDateTime(ownMemberStart, { weekday: true, timeZone: LAUNCH_TIME_ZONE })})`,
    changedSinceReady && "Edited since it was marked ready",
    readingOverEstimate(entry),
    action.archived && "Archived",
    memberCount === 0 && "No members in its cohort",
  ].filter((note): note is string => !!note);
};

function UnfinishedItems({
  items,
  onToggle,
}: {
  items: { label: string; dismissed: boolean }[];
  onToggle: (dismissed: boolean) => void;
}) {
  const dismissed = items.every((item) => item.dismissed);
  return (
    <div className="flex items-start gap-2">
      <p
        className={cn(
          "min-w-0 flex-1 text-caption",
          dismissed ? "text-fg-muted" : "font-medium text-warning",
        )}
      >
        {dismissed ? "Unfinished (dismissed): " : "Unfinished: "}
        {dismissed
          ? items.map((item) => item.label).join(", ")
          : items.map((item, index) => (
              <Fragment key={item.label}>
                {index > 0 && ", "}
                {item.dismissed ? (
                  <span className="font-normal text-fg-muted">
                    {item.label} (dismissed)
                  </span>
                ) : (
                  item.label
                )}
              </Fragment>
            ))}
      </p>
      <Button
        size="small"
        variant={ButtonVariant.Ghost}
        aria-label={`${dismissed ? "Restore" : "Dismiss"} unfinished items`}
        className="-my-1.5"
        onClick={() => onToggle(!dismissed)}
      >
        {dismissed ? "Restore" : "Dismiss"}
      </Button>
    </div>
  );
}

/** Each task's readiness, and the mark staff set once they've looked at it. */
export function TasksCheck({
  actions,
  checkedActionIds,
  changedActionIds,
  schedule,
  onCheckedChange,
  dismissedKeys,
  onDismiss,
  onRestore,
}: {
  actions: LaunchAction[];
  checkedActionIds: ReadonlySet<number>;
  /** Marked ready, then edited. */
  changedActionIds: ReadonlySet<number>;
  schedule: LaunchSchedule;
  onCheckedChange: (entry: LaunchAction, checked: boolean) => void;
  dismissedKeys: ReadonlySet<string>;
  onDismiss: (keys: string[]) => void;
  onRestore: (keys: string[]) => void;
}) {
  const { tags, isError: tagsFailed } = useTagsAdmin();
  const { data: allActions = [], isError: actionsFailed } = useActionsAdmin();
  const formDisplaySlugs = useFormDisplaySlugs();
  const names = cohortNames({ tags, actions: allActions, formDisplaySlugs });
  const suiteActionIds = new Set(actions.map(({ action }) => action.id));
  const referencedActions = allActions.map((item) => ({
    ...referencedActionFromListItem(item),
    name: item.name,
    // This suite's tasks close at the office deadline this launch creates.
    ...(suiteActionIds.has(item.id) && { deadline: schedule.officeActionAt }),
  }));
  const unready = actions.filter((entry) =>
    checklistBlocks(entry, dismissedKeys),
  ).length;
  const unchecked = actions.filter(
    ({ action }) => !checkedActionIds.has(action.id),
  ).length;

  return (
    <LaunchCheck
      id={LaunchSection.Actions}
      title={actions.length === 1 ? "Task" : "Tasks"}
      passed={unready === 0 && unchecked === 0}
      summary={`${unready} with unfinished checklist items · ${unchecked} not yet marked ready`}
      flush
    >
      {(tagsFailed || actionsFailed) && (
        <p className="border-b border-line px-card py-3 text-danger">
          {tagsFailed && "Couldn't load tags, so cohorts show tag ids. "}
          {actionsFailed && "Couldn't load tasks, so cohorts show task ids."}
        </p>
      )}
      <ul className="divide-y divide-line">
        {actions.map((entry) => {
          const { action, unready: items, memberCount } = entry;
          const notes = taskNotes({
            entry,
            changedSinceReady: changedActionIds.has(action.id),
          });
          return (
            <li key={action.id} className="flex flex-col gap-2 px-card py-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 font-medium">
                  {action.name}
                  <span className="ml-2 font-normal text-fg-muted">
                    {action.timeEstimate ?? "—"} min
                    {action.optional && " · optional"}
                  </span>
                </p>
                <TaskLinks
                  actionId={action.id}
                  taskFormId={action.taskFormId}
                />
              </div>
              <p className="text-caption text-fg-muted">
                {memberCount === null
                  ? "Members unknown"
                  : countOf(memberCount, "member")}{" "}
                ·{" "}
                {cohortSegmentsText(
                  describeCohortExpression(action.cohortExpression, names),
                )}
              </p>
              {notes.length > 0 && (
                <p className="text-caption font-medium text-warning">
                  {notes.join(" · ")}
                </p>
              )}
              {items.length > 0 && (
                <UnfinishedItems
                  items={items.map((item) => ({
                    label: item.label,
                    dismissed: dismissedKeys.has(
                      checklistKey(action.id, item.id),
                    ),
                  }))}
                  onToggle={(dismissed) =>
                    dismissed
                      ? onDismiss(checklistDismissKeys(entry))
                      : onRestore(
                          actionChecklistDismissals(action.id, dismissedKeys),
                        )
                  }
                />
              )}
              <OpenReferenceWarning
                actionId={action.id}
                expression={action.cohortExpression}
                prerequisiteActionIds={action.prerequisiteActionIds}
                memberActionStart={schedule.memberActionAt}
                memberActionDeadline={schedule.officeActionAt}
                actions={referencedActions}
              />
              <CheckboxField
                label="Ready to launch"
                className="mt-1"
                checked={checkedActionIds.has(action.id)}
                onChange={(event) => onCheckedChange(entry, event.target.checked)}
              />
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
}
