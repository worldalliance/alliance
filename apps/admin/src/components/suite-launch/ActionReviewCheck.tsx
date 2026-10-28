import { ActionLinks } from "./ActionLinks";
import LaunchCheck from "./LaunchCheck";
import type { LaunchAction } from "./useSuiteLaunchData";

const ActionReviewCheck = ({
  actions,
  checkedActionIds,
  onCheckedChange,
}: {
  actions: LaunchAction[];
  checkedActionIds: ReadonlySet<number>;
  onCheckedChange: (actionId: number, checked: boolean) => void;
}) => {
  const unready = actions.filter((entry) => entry.unready.length > 0).length;
  const unchecked = actions.filter(
    ({ action }) => !checkedActionIds.has(action.id),
  ).length;
  return (
    <LaunchCheck
      title="Actions"
      passed={unready === 0 && unchecked === 0}
      summary={`${unready} with unfinished checklist items · ${unchecked} not yet checked`}
    >
      <ul className="divide-y divide-zinc-100">
        {actions.map(({ action, unready }) => (
          <li key={action.id} className="flex items-start gap-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {action.name}
                <span className="ml-2 text-xs text-zinc-500">
                  {action.timeEstimate ?? "?"} min
                  {action.optional && " · optional"}
                </span>
              </p>
              {unready.length > 0 && (
                <p className="text-xs text-yellow-700">
                  Missing: {unready.map((item) => item.label).join(", ")}
                </p>
              )}
            </div>
            <ActionLinks actionId={action.id} />
            <label className="flex items-center gap-1.5 text-sm text-nowrap">
              <input
                type="checkbox"
                checked={checkedActionIds.has(action.id)}
                onChange={(e) => onCheckedChange(action.id, e.target.checked)}
              />
              I checked this
            </label>
          </li>
        ))}
      </ul>
    </LaunchCheck>
  );
};

export default ActionReviewCheck;
