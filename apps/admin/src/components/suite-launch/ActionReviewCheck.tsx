import { withCount } from "@alliance/common/plural";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { secondsInMinute } from "date-fns/constants";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../../lib/describeCohortExpression";
import { referencedActionFromListItem } from "../../lib/referencedAction";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import OpenReferenceWarning from "../OpenReferenceWarning";
import { ActionLinks, EditTaskFormLink } from "./ActionLinks";
import { LaunchSection } from "./launchBlockers";
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

const ActionReviewCheck = ({
  actions,
  checkedActionIds,
  changedActionIds,
  schedule,
  onCheckedChange,
}: {
  actions: LaunchAction[];
  checkedActionIds: ReadonlySet<number>;
  /** Marked ready, then edited. */
  changedActionIds: ReadonlySet<number>;
  schedule: LaunchSchedule;
  onCheckedChange: (entry: LaunchAction, checked: boolean) => void;
}) => {
  const { tags, isError: tagsFailed } = useTagsAdmin();
  const { data: allActions = [], isError: actionsFailed } = useActionsAdmin();
  const names = cohortNames({ tags, actions: allActions });
  const suiteActionIds = new Set(actions.map(({ action }) => action.id));
  const referencedActions = allActions.map((item) => ({
    ...referencedActionFromListItem(item),
    name: item.name,
    // This suite's actions close at the office deadline this launch creates.
    ...(suiteActionIds.has(item.id) && { deadline: schedule.officeActionAt }),
  }));
  const unready = actions.filter((entry) => entry.unready.length > 0).length;
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
                  <p className="text-xs text-yellow-700">
                    Unfinished: {unready.map((item) => item.label).join(", ")}
                  </p>
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
