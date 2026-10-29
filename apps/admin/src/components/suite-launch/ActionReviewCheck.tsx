import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { secondsInMinute } from "date-fns/constants";
import {
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
                  <p className="text-xs text-yellow-700">
                    Missing: {unready.map((item) => item.label).join(", ")}
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
