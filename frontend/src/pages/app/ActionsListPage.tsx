import React, { useEffect, useMemo, useState } from "react";
import ActionItemCard, {
  ActionCardAction,
} from "../../components/ActionItemCard";
import { useNavigate } from "react-router-dom";
import Button, { ButtonColor } from "../../components/system/Button";
import { actionsFindAll } from "../../client/sdk.gen";
import { ActionDto } from "../../client/types.gen";

enum FilterMode {
  All = "all",
  Active = "Active",
  Upcoming = "Upcoming",
  Past = "Past",
  Draft = "Draft",
  Joined = "joined",
}

const ActionsListPage: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActions = async () => {
      try {
        console.log("fetching actions");

        const response = await actionsFindAll();

        if (response.error) {
          throw new Error("Failed to fetch actions");
        }

        setActions(response.data || []);
        setLoading(false);
      } catch (err) {
        setError("Failed to load actions. Please try again later.");
        setLoading(false);
        console.error("Error fetching actions:", err);
      }
    };

    fetchActions();
  }, []);

  const filteredActions = useMemo(() => {
    if (filterMode === FilterMode.All) {
      return actions;
    }

    if (filterMode === FilterMode.Joined) {
      return actions; //todo: implement
    }

    return actions.filter((action) => action.status === filterMode);
  }, [actions, filterMode]);

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 items-center">
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
                label={mode}
              ></Button>
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
            title={action.name}
            description={action.description}
            category={action.category}
            actions={[ActionCardAction.Details]}
            onClick={() => navigate(`/action/${action.id}`)}
            className="w-full"
          />
        ))}
      </div>
    </div>
  );
};

export default ActionsListPage;
