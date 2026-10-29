import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { cn } from "@alliance/shared/styles/util";
import { secondsInMinute } from "date-fns/constants";
import { Undo2, X } from "lucide-react";
import {
  cohortSegmentsText,
  describeCohortExpression,
} from "../../lib/describeCohortExpression";
import { referencedActionFromListItem } from "../../lib/referencedAction";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import OpenReferenceWarning from "../OpenReferenceWarning";
import { ActionLinks, EditTaskFormLink, iconControlClass } from "./ActionLinks";
import { checklistDismissKey, LaunchSection } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import { inLaunchZone, type LaunchSchedule } from "./launchSchedule";
import type { LaunchAction } from "./useSuiteLaunchData";

const readingOverEstimate = ({ action, readingSeconds }: LaunchAction) =>
  action.timeEstimate != null &&
  readingSeconds > action.timeEstimate * secondsInMinute &&
  `Reading alone takes about ${Math.ceil(readingSeconds / secondsInMinute)} min, more than its ${action.timeEstimate} min estimate`;

const actionNotes = (params: {
  entry: LaunchAction;
  changedSinceReady: boolean;
  /** When the action's own members taking action event starts, if it has one. */
  ownMemberStart: string | null;
}) => {
  const { entry, changedSinceReady, ownMemberStart } = params;
  const { action, memberCount } = entry;
  return [
    ownMemberStart &&
      `Already has its own members taking action event (${inLaunchZone(new Date(ownMemberStart))}), so launching announces it again`,
    changedSinceReady && "Edited since it was marked ready",
    readingOverEstimate(entry),
    action.archived && "Archived",
    memberCount === 0 && "No members in its cohort",
  ].filter((note): note is string => !!note);
};

const MissingItems = ({
  labels,
  dismissed,
  onToggle,
}: {
  labels: string[];
  dismissed: boolean;
  onToggle: (dismissed: boolean) => void;
}) => (
  <p
    className={cn(
      "flex items-center gap-1 text-xs",
      dismissed ? "text-zinc-400" : "text-yellow-700",
    )}
  >
    {dismissed ? "Missing (dismissed): " : "Missing: "}
    {labels.join(", ")}
    <button
      type="button"
      onClick={() => onToggle(!dismissed)}
      aria-label={dismissed ? "Restore missing items" : "Dismiss missing items"}
      title={dismissed ? "Restore" : "Dismiss and launch anyway"}
      className={iconControlClass}
    >
      {dismissed ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
    </button>
  </p>
);

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
  onDismiss: (key: string) => void;
  onRestore: (key: string) => void;
}) => {
  const { tags } = useTagsAdmin();
  const { data: allActions = [] } = useActionsAdmin();
  const cohortNames = {
    tagNames: new Map(tags.map((tag) => [tag.id, tag.name])),
    actionNames: new Map(allActions.map((action) => [action.id, action.name])),
  };
  const suiteActionIds = new Set(actions.map(({ action }) => action.id));
  const memberStartById = new Map(
    allActions.map((item) => [item.id, item.memberActionStart]),
  );
  const referencedActions = allActions.map((item) => ({
    ...referencedActionFromListItem(item),
    name: item.name,
    // This suite's actions close at the office deadline this launch creates.
    ...(suiteActionIds.has(item.id) && { deadline: schedule.officeActionAt }),
  }));
  const unready = actions.filter(
    (entry) =>
      entry.unready.length > 0 &&
      !dismissedKeys.has(checklistDismissKey(entry)),
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
      <ul className="divide-y divide-zinc-100">
        {actions.map((entry) => {
          const { action, unready, memberCount } = entry;
          const notes = actionNotes({
            entry,
            changedSinceReady: changedActionIds.has(action.id),
            ownMemberStart: memberStartById.get(action.id) ?? null,
          });
          return (
            <li key={action.id} className="flex items-start gap-3 py-2">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {action.name}
                  <span className="ml-2 text-xs text-zinc-500">
                    {action.timeEstimate ?? "?"} min
                    {action.optional && " · optional"}
                  </span>
                </p>
                <p className="text-xs text-zinc-500">
                  {memberCount ?? "?"} members ·{" "}
                  {cohortSegmentsText(
                    describeCohortExpression(
                      action.cohortExpression,
                      cohortNames,
                    ),
                  )}
                </p>
                {notes.length > 0 && (
                  <p className="text-xs text-yellow-700">{notes.join(" · ")}</p>
                )}
                {unready.length > 0 && (
                  <MissingItems
                    labels={unready.map((item) => item.label)}
                    dismissed={dismissedKeys.has(checklistDismissKey(entry))}
                    onToggle={(dismissed) =>
                      (dismissed ? onDismiss : onRestore)(
                        checklistDismissKey(entry),
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
