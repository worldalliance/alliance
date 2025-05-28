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

const ActionsListPage: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);
  const [liveCounts, setLiveCounts] = useState<Record<number, number>>({});

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // let evtSource: EventSource | null = null;
    const req = isAuthenticated
      ? actionsFindAllWithStatus
      : actionsFindAllPublic;

    req().then((response) => {
      if (response.data) {
        setActions(response.data || []);

        // const ids = response.data.map((a) => a.id);

        // evtSource = new EventSource(getBulkActionSSEUrl(ids));

        // evtSource.onmessage = (e) => {
        //   const counts = JSON.parse(e.data);
        //   setLiveCounts(counts);
        // };
      } else {
        setError("Failed to load actions");
      }
      setLoading(false);
    });
    return () => {
      //   evtSource?.close();
    };
  }, [isAuthenticated]);

  const filteredActions = useMemo(() => filterActions(actions, filterMode), [actions, filterMode]);

  return (
    <div className="flex flex-col min-h-screen bg-white items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(600px,100%))] gap-y-3">
        <div className="flex py-8 flex-row justify-between items-center w-[90%]">
          <p className="font-sabon text-xl text-left h-fit pt-2">Filter:</p>
          <div className="flex flex-row gap-x-2 items-center">
            {Object.values(FilterMode).map((mode) => (
              <Button
                key={mode}
                color={
                  filterMode === mode ? ButtonColor.Blue : ButtonColor.Light
                }
                onClick={() => setFilterMode(mode)}
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
            liveCount={liveCounts[action.id] ?? action.usersJoined}
          />
        ))}
      </div>
    </div>
  );
};

export default ActionsListPage;
