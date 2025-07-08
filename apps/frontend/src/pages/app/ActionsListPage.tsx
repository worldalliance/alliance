import React, { useEffect, useMemo, useState } from "react";
import ActionItemCard from "../../components/ActionItemCard";
import Button, { ButtonColor } from "../../components/system/Button";
import {
  actionsFindAllPublic,
  actionsFindAllWithStatus,
} from "@alliance/shared/client";
import { ActionDto } from "@alliance/shared/client";
import { useAuth } from "../../lib/AuthContext";
import { FilterMode, filterActions } from "@alliance/shared/lib/actionUtils";
import { useActionCounts } from "../../lib/useActionWebSocket";

const ActionsListPage: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);

  const { isAuthenticated } = useAuth();

  const actionIds = useMemo(() => actions.map((a) => a.id), [actions]);
  const liveCounts = useActionCounts(actionIds);

  useEffect(() => {
    const req = isAuthenticated
      ? actionsFindAllWithStatus
      : actionsFindAllPublic;

    req().then((response) => {
      if (response.data) {
        setActions(response.data || []);
      } else {
        setError("Failed to load actions");
      }
      setLoading(false);
    });
  }, [isAuthenticated]);

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

        {loading && <p className="text-center py-4">Loading actions...</p>}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

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
