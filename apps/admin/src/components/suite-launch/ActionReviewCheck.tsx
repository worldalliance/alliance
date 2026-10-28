import { withCount } from "@alliance/common/plural";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import {
  cohortNames,
  cohortSegmentsText,
  describeCohortExpression,
} from "../../lib/describeCohortExpression";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import { ActionLinks, EditTaskFormLink } from "./ActionLinks";
import LaunchCheck from "./LaunchCheck";
import type { LaunchAction } from "./useSuiteLaunchData";

const actionNotes = ({ action, memberCount }: LaunchAction) =>
  [
    action.archived && "Archived",
    !action.image && "No cover image",
    memberCount === 0 && "No members in its cohort",
  ].filter((note): note is string => !!note);

const ActionReviewCheck = ({
  actions,
  checkedActionIds,
  onCheckedChange,
}: {
  actions: LaunchAction[];
  checkedActionIds: ReadonlySet<number>;
  onCheckedChange: (actionId: number, checked: boolean) => void;
}) => {
  const { tags, isError: tagsFailed } = useTagsAdmin();
  const { data: allActions = [], isError: actionsFailed } = useActionsAdmin();
  const names = cohortNames({ tags, actions: allActions });
  const unready = actions.filter((entry) => entry.unready.length > 0).length;
  const unchecked = actions.filter(
    ({ action }) => !checkedActionIds.has(action.id),
  ).length;
  return (
    <LaunchCheck
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
          const notes = actionNotes(entry);
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
              </div>
              <ActionLinks actionId={action.id} />
              {action.taskFormId && (
                <EditTaskFormLink formId={action.taskFormId} />
              )}
              <label className="flex items-center gap-1.5 text-sm text-nowrap">
                <input
                  type="checkbox"
                  checked={checkedActionIds.has(action.id)}
                  onChange={(e) => onCheckedChange(action.id, e.target.checked)}
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
