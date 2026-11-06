import { withCount } from "@alliance/common/plural";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useFormDisplaySlugs } from "@alliance/shared/lib/useFormsAdmin";
import { cn } from "@alliance/shared/styles/util";
import { secondsInMinute } from "date-fns/constants";
import { Fragment } from "react";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../../lib/describeCohortExpression";
import { inLaunchZone } from "../../lib/launchTimeZone";
import { referencedActionFromListItem } from "../../lib/referencedAction";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import OpenReferenceWarning from "../OpenReferenceWarning";
import { ActionLinks, EditTaskFormLink } from "./ActionLinks";
import DismissToggle from "./DismissToggle";
import {
  actionChecklistDismissals,
  checklistBlocks,
  checklistDismissKeys,
  checklistKey,
  LaunchSection,
} from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import type { LaunchSchedule } from "./launchSchedule";
import type { LaunchAction } from "./useSuiteLaunchData";

const readingOverEstimate = ({ action, readingSeconds }: LaunchAction) =>
  action.timeEstimate != null &&
  readingSeconds > action.timeEstimate * secondsInMinute &&
  `Reading alone takes about ${Math.ceil(readingSeconds / secondsInMinute)} min, more than its ${action.timeEstimate} min estimate`;

const actionNotes = (params: {
  entry: LaunchAction;
  changedSinceReady: boolean;
}) => {
  const { entry, changedSinceReady } = params;
  const { action, memberCount, ownMemberStart } = entry;
  return [
    ownMemberStart &&
      `Already has its own members taking action event (${inLaunchZone(new Date(ownMemberStart))})`,
    changedSinceReady && "Edited since it was marked ready",
    readingOverEstimate(entry),
    action.archived && "Archived",
    memberCount === 0 && "No members in its cohort",
  ].filter((note): note is string => !!note);
};

const UnfinishedItems = ({
  items,
  onToggle,
}: {
  items: { label: string; dismissed: boolean }[];
  onToggle: (dismissed: boolean) => void;
}) => {
  const dismissed = items.every((item) => item.dismissed);
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        dismissed ? "text-zinc-400" : "text-yellow-700",
      )}
    >
      {dismissed ? "Unfinished (dismissed): " : "Unfinished: "}
      {dismissed
        ? items.map((item) => item.label).join(", ")
        : items.map((item, index) => (
            <Fragment key={item.label}>
              {index > 0 && ", "}
              {item.dismissed ? (
                <span className="text-zinc-400">{item.label} (dismissed)</span>
              ) : (
                item.label
              )}
            </Fragment>
          ))}
      <DismissToggle
        dismissed={dismissed}
        what="unfinished items"
        iconClassName="size-3.5"
        onToggle={() => onToggle(!dismissed)}
      />
    </p>
  );
};

const ActionReviewCheck = ({
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
}) => {
  const { tags, isError: tagsFailed } = useTagsAdmin();
  const { data: allActions = [], isError: actionsFailed } = useActionsAdmin();
  const formDisplaySlugs = useFormDisplaySlugs();
  const names = cohortNames({
    tags,
    actions: allActions,
    formDisplaySlugs,
  });
  const suiteActionIds = new Set(actions.map(({ action }) => action.id));
  const referencedActions = allActions.map((item) => ({
    ...referencedActionFromListItem(item),
    name: item.name,
    // This suite's actions close at the office deadline this launch creates.
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
      title="Actions"
      passed={unready === 0 && unchecked === 0}
      summary={`${unready} with unfinished checklist items · ${unchecked} not yet marked ready`}
    >
      {tagsFailed && (
        <p className="text-sm text-red-600">
          Failed to load tags, so cohorts show tag ids.
        </p>
      )}
      {actionsFailed && (
        <p className="text-sm text-red-600">
          Failed to load actions, so cohorts show action ids.
        </p>
      )}
      <ul className="divide-y divide-zinc-100">
        {actions.map((entry) => {
          const { action, unready, memberCount } = entry;
          const notes = actionNotes({
            entry,
            changedSinceReady: changedActionIds.has(action.id),
          });
          return (
            <li key={action.id} className="flex items-start gap-3 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {action.name}
                  <span className="ml-2 text-xs text-zinc-500">
                    {action.timeEstimate ?? "?"} min
                    {action.optional && " · optional"}
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  {memberCount === null
                    ? "? members"
                    : withCount(memberCount, "member")}{" "}
                  ·{" "}
                  {cohortSegmentsText(
                    describeCohortExpression(action.cohortExpression, names),
                  )}
                </p>
                {notes.length > 0 && (
                  <p className="text-xs text-yellow-700">{notes.join(" · ")}</p>
                )}
                {unready.length > 0 && (
                  <UnfinishedItems
                    items={unready.map((item) => ({
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
              </div>
              <ActionLinks actionId={action.id} />
              {action.taskFormId && (
                <EditTaskFormLink formId={action.taskFormId} />
              )}
              <label className="flex items-center gap-1.5 text-sm text-nowrap">
                <input
                  type="checkbox"
                  checked={checkedActionIds.has(action.id)}
                  onChange={(e) => onCheckedChange(entry, e.target.checked)}
                />
                Ready to launch
              </label>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};

export default ActionReviewCheck;
