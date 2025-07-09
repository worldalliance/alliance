import { useMemo, useState } from "react";
import ActionItemCard from "../../components/ActionItemCard";
import Button, { ButtonColor } from "../../components/system/Button";
import { FilterMode, filterActions } from "@alliance/shared/lib/actionUtils";
import { useActionCounts } from "../../lib/useActionWebSocket";
import { getLoadedActionData, RouteMatches } from "../../applayout";

const ActionsListPage = ({ matches }: RouteMatches) => {
  const { actions } = getLoadedActionData(matches);
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);

  const actionIds = useMemo(() => actions.map((a) => a.id), [actions]);
  const liveCounts = useActionCounts(actionIds);

  const filteredActions = useMemo(
    () => filterActions(actions, filterMode),
    [actions, filterMode]
  );

  return (
    <div className="flex flex-col min-h-screen bg-white items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(650px,100%))] gap-y-3">
        <div className="flex py-8 flex-row justify-center items-center w-[90%] gap-x-4">
          <p className="text-lg text-left h-fit">Filter:</p>
          <div className="flex flex-row gap-x-2 items-center">
            {Object.values(FilterMode).map((mode) => (
              <Button
                key={mode}
                color={
                  filterMode === mode ? ButtonColor.Blue : ButtonColor.Outline
                }
                onClick={() => setFilterMode(mode)}
                className="text-nowrap"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>

        {filteredActions.map((action) => (
          <ActionItemCard
            key={action.id}
            {...action}
            className="w-full"
            joinedCount={liveCounts[action.id] ?? action.usersJoined}
            completedCount={
              action.status === "member_action"
                ? action.usersCompleted
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
};

export default ActionsListPage;
