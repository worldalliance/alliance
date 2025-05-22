import React, { useEffect, useState, useCallback } from "react";
import { HomeTaskView } from "../../components/HomeTaskView";
import {
  ActionDto,
  actionsComplete,
  actionsFindAllWithStatus,
} from "../../../../../shared/client";
import { client } from "../../../../../shared/client/client.gen";
import { useAuth } from "../../lib/AuthContext";
import { getApiUrl } from "../../lib/config";
import { HomeNewActionsView } from "../../components/HomeNewActionsView";

const HomePage: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [todoActions, setTodoActions] = useState<ActionDto[]>([]);
  const [newActions, setNewActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading } = useAuth();

  console.log(actions);

  const updateActions = useCallback((actions: ActionDto[]) => {
    setActions(actions);
    setTodoActions(
      actions.filter((action) => action.myRelation?.status === "joined")
    );
    setNewActions(
      actions.filter(
        (action) => !action.myRelation || action.myRelation.status === "none"
      )
    );
  }, []);

  useEffect(() => {
    if (authLoading) return;
    client.setConfig({
      baseUrl: getApiUrl(),
      credentials: "include",
    });
    actionsFindAllWithStatus()
      .then(({ data }) => {
        if (data) {
          updateActions(data);
        }
      })
      .catch(() => setError("Failed to load actions"));
  }, [authLoading, updateActions]);

  const handleTaskComplete = (actionId: number) => {
    actionsComplete({ path: { id: actionId.toString() } }).then(() => {
      updateActions(actions.filter((action) => action.id !== actionId));
    });
  };

  return (
    <div className="flex flex-col w-full h-full items-center bg-white">
      <div className="flex flex-col py-12 w-[600px] gap-y-5 overflow-y-auto">
        {error && <p className="text-red-500">{error}</p>}
        <HomeTaskView
          actions={todoActions}
          onTaskComplete={handleTaskComplete}
        />
        <HomeNewActionsView actions={newActions} />
      </div>
    </div>
  );
};

export default HomePage;
